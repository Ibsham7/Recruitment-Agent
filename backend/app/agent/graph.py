from langgraph.graph import StateGraph, START, END
try:
    # Prefer the interrupt function from langgraph if available
    from langgraph.types import interrupt
except Exception:
    # Fallback: provide a clear runtime error if interrupt is not available.
    def interrupt(value):
        raise RuntimeError(
            "interrupt() is not available in this environment. "
            f"Payload: {value!r}"
        )
from langgraph.checkpoint.memory import MemorySaver
from importlib import import_module
from state import RecruitmentState
from nodes.cv_parser import cv_parser_node
from nodes.hard_filters import hard_filters_node
from nodes.embedding_matcher import embedding_matcher_node
from nodes.jd_matcher import jd_matcher_node
from nodes.question_generator import question_generator_node
from nodes.interviewer import interviewer_node
from nodes.evaluator import evaluator_node

# ── Routing functions ──────────────────────────────────────────────────────

def route_after_hard_filters(state: RecruitmentState) -> str:
    if state["pipeline_status"] == "rejected":
        return "rejected"
    return "embedding_matcher"

def route_after_embedding_matcher(state: RecruitmentState) -> str:
    if state["pipeline_status"] == "rejected":
        return "rejected"
    return "jd_matcher"

def route_after_screening(state: RecruitmentState) -> str:
    """After JD matching: advance to interview or reject immediately."""
    if state["pipeline_status"] == "rejected":
        return "rejected"
    return "question_generator"

def route_after_interview_turn(state: RecruitmentState) -> str:
    """After each interview question: loop back or move to evaluation."""
    transcript = state.get("interview_transcript")
    questions = state.get("interview_questions", [])

    if transcript is None:
        return "interviewer"   # first question not asked yet

    if transcript.current_question_index >= len(questions):
        return "evaluator"    # all questions answered

    return "interviewer"      # more questions remain

def route_after_evaluation(state: RecruitmentState) -> str:
    """After evaluation: go to human review or end."""
    return "human_review"

def human_review_node(state: RecruitmentState) -> dict:
    """
    Placeholder node — in the actual pipeline this is where the graph
    interrupts and waits for a human recruiter to approve/reject the shortlist.
    Human provides their decision via graph.update_state().
    """
    profile = state.get("candidate_profile")
    eval_report = state.get("evaluation_report")
    screening = state.get("screening_result")
    if profile is None:
        raise ValueError("candidate_profile is required for human review")
    if eval_report is None:
        raise ValueError("evaluation_report is required for human review")
    if screening is None:
        raise ValueError("screening_result is required for human review")

    decision = interrupt({
        "type": "human_review",
        "candidate": profile.name,
        "evaluation": {
            "overall_score": eval_report.overall_score,
            "recommendation": eval_report.recommendation,
            "summary": eval_report.summary,
            "strengths": eval_report.strengths, # type: ignore
            "concerns": eval_report.concerns, # type: ignore
        },
        "screening_score": screening.fit_score,
        "message": "Review this candidate and provide your decision: approve | reject | hold"
    })

    return {
        "human_decision": str(decision),
        "pipeline_status": "complete",
        "log": [f"Human decision: {decision}"]
    }

def rejected_node(state: RecruitmentState) -> dict:
    """Terminal node for screened-out candidates."""
    return {
        "pipeline_status": "rejected",
        "log": [f"Pipeline ended: rejected at screening"]
    }

# ── Build the graph ────────────────────────────────────────────────────────

def build_recruitment_graph(use_sqlite: bool = False):
    """
    Build and compile the recruitment pipeline graph.
    
    use_sqlite=False  → MemorySaver (dev, disappears on restart)
    use_sqlite=True   → SqliteSaver (persists to disk, use for real runs)
    """
    builder = StateGraph(RecruitmentState)

    # Register nodes
    builder.add_node("cv_parser", cv_parser_node)
    builder.add_node("hard_filters", hard_filters_node)
    builder.add_node("embedding_matcher", embedding_matcher_node)
    builder.add_node("jd_matcher", jd_matcher_node)
    builder.add_node("question_generator", question_generator_node)
    builder.add_node("interviewer", interviewer_node)
    builder.add_node("evaluator", evaluator_node)
    builder.add_node("human_review", human_review_node)
    builder.add_node("rejected", rejected_node)

    # Edges
    builder.add_edge(START, "cv_parser")
    builder.add_edge("cv_parser", "hard_filters")

    builder.add_conditional_edges(
        "hard_filters",
        route_after_hard_filters,
        {"embedding_matcher": "embedding_matcher", "rejected": "rejected"}
    )

    builder.add_conditional_edges(
        "embedding_matcher",
        route_after_embedding_matcher,
        {"jd_matcher": "jd_matcher", "rejected": "rejected"}
    )

    # Conditional: screening result decides whether to advance or reject
    builder.add_conditional_edges(
        "jd_matcher",
        route_after_screening,
        {"question_generator": "question_generator", "rejected": "rejected"}
    )

    builder.add_edge("question_generator", "interviewer")

    # Conditional loop: interview question by question
    builder.add_conditional_edges(
        "interviewer",
        route_after_interview_turn,
        {"interviewer": "interviewer", "evaluator": "evaluator"}
    )

    builder.add_edge("evaluator", "human_review")

    # Both human_review and rejected lead to END
    builder.add_edge("human_review", END)
    builder.add_edge("rejected", END)

    # Checkpointer — required for interrupt() to work
    if use_sqlite:
        try:
            sqlite_module = import_module("langgraph.checkpoint.sqlite")
            SqliteSaver = getattr(sqlite_module, "SqliteSaver")
            checkpointer = SqliteSaver.from_conn_string("recruitment.db")
        except Exception:
            checkpointer = MemorySaver()
    else:
        checkpointer = MemorySaver()

    return builder.compile(checkpointer=checkpointer)