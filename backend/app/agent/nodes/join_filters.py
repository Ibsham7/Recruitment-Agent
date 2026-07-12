from app.agent.state import RecruitmentState

async def join_filters_node(state: RecruitmentState) -> dict:
    """
    Node that runs after both hard_filters and embedding_matcher have completed in parallel.
    It inspects the filter_rejections list and updates the pipeline_status accordingly.
    """
    rejections = state.get("filter_rejections", [])
    
    if rejections:
        reason = "\n".join(rejections)
        print(f"\n[Join Filters] Candidate rejected by parallel filters. Reasons:\n{reason}")
        return {
            "pipeline_status": "rejected",
            "rejection_reason": reason,
            "log": [f"Pipeline rejected during local filters. Reasons: {reason}"]
        }
    
    print("\n[Join Filters] Candidate passed all local parallel filters.")
    return {
        "pipeline_status": "running",
        "log": ["Passed all local parallel filters."]
    }
