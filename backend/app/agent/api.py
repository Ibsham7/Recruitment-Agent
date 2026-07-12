import asyncio
from typing import Any, cast
from prisma import Prisma
from .graph import build_recruitment_graph

async def start_candidate_pipeline(candidate_id: str, cv_url: str, jd_text: str):
    prisma = Prisma()
    await prisma.connect()
    
    def _run_graph():
        graph = build_recruitment_graph(use_sqlite=True)
        config = {"configurable": {"thread_id": candidate_id}}
        
        initial_state = {
            "cv_filepath": cv_url,
            "job_description": jd_text,
            "candidate_id": candidate_id,
            "candidate_profile": None,
            "screening_result": None,
            "interview_questions": [],
            "interview_transcript": None,
            "evaluation_report": None,
            "pipeline_status": "running",
            "rejection_reason": None,
            "log": [],
            "human_decision": None,
            "human_notes": None,
        }

        current_state = graph.get_state(config)
        input_state = initial_state if getattr(current_state, "values", {}) == {} else None

        events = graph.stream(cast(Any, input_state), config=config, stream_mode="updates")
        
        interrupt_value = None
        final_state_values = None
        try:
            for event in events:
                for node_name, node_output in event.items():
                    if node_name == "__interrupt__":
                        interrupt_value = node_output[0].value
            
            final_state_values = graph.get_state(config).values
        except Exception as e:
            print(f"Error: {e}")
            
        return interrupt_value, final_state_values
        
    try:
        interrupt_value, final_state = await asyncio.to_thread(_run_graph)
        
        if interrupt_value:
            interrupt_type = interrupt_value.get("type", "interview")
            if interrupt_type == "human_review":
                await prisma.candidate.update(
                    where={"id": candidate_id},
                    data={"status": "review"}
                )
            else:
                # Interview question
                await prisma.candidate.update(
                    where={"id": candidate_id},
                    data={
                        "status": "interviewing"
                    }
                )
        elif final_state:
            status = final_state.get("pipeline_status", "complete")
            if status == "complete":
                # Add human decision logic
                decision = final_state.get("human_decision", "")
                await prisma.candidate.update(where={"id": candidate_id}, data={"status": "complete", "decision": decision})
            else:
                await prisma.candidate.update(where={"id": candidate_id}, data={"status": status})
            
    finally:
        await prisma.disconnect()

async def resume_pipeline(candidate_id: str, resume_data: Any):
    prisma = Prisma()
    await prisma.connect()
    
    def _resume_graph():
        from langgraph.types import Command
        graph = build_recruitment_graph(use_sqlite=True)
        config = {"configurable": {"thread_id": candidate_id}}
        
        events = graph.stream(Command(resume=resume_data), config=config, stream_mode="updates")
        
        interrupt_value = None
        final_state_values = None
        for event in events:
            for node_name, node_output in event.items():
                if node_name == "__interrupt__":
                    interrupt_value = node_output[0].value
                    
        final_state_values = graph.get_state(config).values
        return interrupt_value, final_state_values
        
    try:
        interrupt_value, final_state = await asyncio.to_thread(_resume_graph)
        
        if interrupt_value:
            interrupt_type = interrupt_value.get("type", "interview")
            if interrupt_type == "human_review":
                await prisma.candidate.update(
                    where={"id": candidate_id},
                    data={"status": "review"}
                )
            else:
                await prisma.candidate.update(
                    where={"id": candidate_id},
                    data={
                        "status": "interviewing"
                    }
                )
        elif final_state:
            status = final_state.get("pipeline_status", "complete")
            if status == "complete":
                decision = final_state.get("human_decision", "")
                await prisma.candidate.update(where={"id": candidate_id}, data={"status": "complete", "decision": decision})
            else:
                await prisma.candidate.update(where={"id": candidate_id}, data={"status": status})
    finally:
        await prisma.disconnect()

