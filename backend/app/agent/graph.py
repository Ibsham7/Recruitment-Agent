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

async def human_override_node(state: RecruitmentState) -> dict:
    decision = interrupt("hold_for_review")
    if decision == "override":
        return {
            "pipeline_status": "shortlisted",
            "log": ["Human override: Candidate advanced to shortlist"]
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
    if state.get("pipeline_status") == "awaiting_human":
        return "human_override"
    return "jd_matcher"

def route_after_screening(state: RecruitmentState) -> str:
    """After JD matching: advance to shortlisted (END), hold, or reject immediately."""
    if state.get("pipeline_status") == "rejected":
        return "rejected"
    if state.get("pipeline_status") == "awaiting_human":
        return "human_override"
    return END

async def rejected_node(state: RecruitmentState) -> dict:
    """Terminal node for screened-out candidates."""
    return {
        "pipeline_status": "rejected",
        "log": ["Pipeline ended: rejected at screening"]
    }

# ── Build the graph ────────────────────────────────────────────────────────

def build_recruitment_graph(checkpointer=None):
    """
    Build and compile the recruitment pipeline graph for Workflow 1 (JD Screening).
    
    use_postgres=False  → MemorySaver (dev, disappears on restart)
    use_postgres=True   → PostgresSaver (persists to Supabase, use for real runs)
    """
    builder = StateGraph(RecruitmentState)

    # Register nodes
    builder.add_node("cv_parser", cv_parser_node)
    builder.add_node("hard_filters", hard_filters_node)
    builder.add_node("embedding_matcher", embedding_matcher_node)
    builder.add_node("jd_matcher", jd_matcher_node)
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
        {"jd_matcher": "jd_matcher", "rejected": "rejected", "human_override": "human_override"}
    )

    # Conditional: screening result decides whether to advance (END), hold, or reject
    builder.add_conditional_edges(
        "jd_matcher",
        route_after_screening,
        {"rejected": "rejected", "human_override": "human_override", END: END}
    )
    
    # Conditional: after human override
    builder.add_conditional_edges(
        "human_override",
        lambda state: "rejected" if state.get("pipeline_status") == "rejected" else END,
        {"rejected": "rejected", END: END}
    )

    # rejected leads to END
    builder.add_edge("rejected", END)

    # Checkpointer — required for interrupt() to work
    if not checkpointer:
        from langgraph.checkpoint.memory import MemorySaver
        checkpointer = MemorySaver()

    return builder.compile(checkpointer=checkpointer)