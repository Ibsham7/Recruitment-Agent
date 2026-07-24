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
from app.agent.state import RecruitmentState
from app.agent.nodes.cv_parser import cv_parser_node
from app.agent.nodes.hard_filters import hard_filters_node
from app.agent.nodes.embedding_matcher import embedding_matcher_node
from app.agent.nodes.jd_matcher import jd_matcher_node
from app.agent.nodes.question_generator import question_generator_node
from app.agent.nodes.interviewer import interviewer_node
from app.agent.nodes.evaluator import evaluator_node

async def human_override_node(state: RecruitmentState) -> dict:
    decision = interrupt("hold_for_review")
    if decision == "override":
        if not state.get("enable_interviews", True):
            return {
                "pipeline_status": "shortlisted",
                "log": ["Human override: Candidate auto-shortlisted (Interviews disabled)"]
            }
        return {
            "pipeline_status": "running",
            "log": ["Human override: Candidate advanced to interview"]
        }
    else:
        return {
            "pipeline_status": "rejected",
            "rejection_reason": "Human override: Rejected from hold queue",
            "log": ["Human override: Candidate rejected"]
        }

# ── Routing functions ──────────────────────────────────────────────────────

def route_after_hard_filters(state: RecruitmentState) -> str:
    if state.get("pipeline_status") == "rejected":
        return "rejected"
    return "embedding_matcher"

def route_after_embedding_matcher(state: RecruitmentState) -> str:
    if state.get("pipeline_status") == "rejected":
        return "rejected"
    return "jd_matcher"

def route_after_screening(state: RecruitmentState) -> str:
    """After JD matching: advance to shortlisted, hold, or reject immediately."""
    if state["pipeline_status"] == "rejected":
        return "rejected"
    if state["pipeline_status"] == "awaiting_human":
        return "human_override"
    return END

def route_after_interview_turn(state: RecruitmentState) -> str:
    """After each interview question: loop back or move to evaluation."""
    transcript = state.get("interview_transcript")
    questions = state.get("interview_questions", [])

    if transcript is None:
        return "interviewer"   # first question not asked yet

    if transcript.current_question_index >= len(questions):
        return "evaluator"    # all questions answered

    return "interviewer"      # more questions remain


async def rejected_node(state: RecruitmentState) -> dict:
    """Terminal node for screened-out candidates."""
    return {
        "pipeline_status": "rejected",
        "log": [f"Pipeline ended: rejected at screening"]
    }

# ── Build the graph ────────────────────────────────────────────────────────

def build_recruitment_graph(checkpointer=None):
    """
    Build and compile the recruitment pipeline graph.
    
    use_postgres=False  → MemorySaver (dev, disappears on restart)
    use_postgres=True   → PostgresSaver (persists to Supabase, use for real runs)
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
    builder.add_node("human_override", human_override_node)
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
        {"question_generator": "question_generator", "rejected": "rejected", "evaluator": "evaluator", "human_override": "human_override", END: END}
    )
    
    # Conditional: after human override
    builder.add_conditional_edges(
        "human_override",
        lambda state: "rejected" if state["pipeline_status"] == "rejected" else ("question_generator" if state.get("enable_interviews", True) else END),
        {"rejected": "rejected", "question_generator": "question_generator", "evaluator": "evaluator", END: END}
    )

    builder.add_edge("question_generator", "interviewer")

    # Conditional loop: interview question by question
    builder.add_conditional_edges(
        "interviewer",
        route_after_interview_turn,
        {"interviewer": "interviewer", "evaluator": "evaluator"}
    )

    builder.add_edge("evaluator", END)

    # rejected lead to END
    builder.add_edge("rejected", END)

    # Checkpointer — required for interrupt() to work
    if not checkpointer:
        from langgraph.checkpoint.memory import MemorySaver
        checkpointer = MemorySaver()

    return builder.compile(checkpointer=checkpointer)