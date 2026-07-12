import asyncio
from typing import Any, cast
from app.database import prisma
from .graph import build_recruitment_graph

async def start_candidate_pipeline(candidate_id: str, cv_url: str, jd_text: str):
    # Load existing profile if it's cached
    candidate = await prisma.candidate.find_unique(where={"id": candidate_id}, include={"campaign": True})
    candidate_profile = None
    hard_filters_config = []
    if candidate:
        if candidate.structuredProfile:
            import json
            from app.agent.schemas import CandidateProfile
            profile_data = candidate.structuredProfile
            if isinstance(profile_data, str):
                profile_data = json.loads(profile_data)
            candidate_profile = CandidateProfile(**profile_data)
            
        if candidate.campaign and candidate.campaign.hardFiltersConfig:
            import json
            config_data = candidate.campaign.hardFiltersConfig
            if isinstance(config_data, str):
                config_data = json.loads(config_data)
            hard_filters_config = config_data
            
    import os
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    
    db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if db_url:
        db_url = db_url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
    
    async with AsyncPostgresSaver.from_conn_string(db_url) as checkpointer:
        await checkpointer.setup()
        graph = build_recruitment_graph(checkpointer=checkpointer)
        config = {"configurable": {"thread_id": candidate_id}}
        
        initial_state = {
            "cv_filepath": cv_url,
            "job_description": jd_text,
            "candidate_id": candidate_id,
            "candidate_profile": candidate_profile,
            "hard_filters_config": hard_filters_config,
            "penalties": [],
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
    
        current_state = await graph.aget_state(config)
        input_state = initial_state if getattr(current_state, "values", {}) == {} else None
    
        interrupt_value = None
        final_state = None
        try:
            events = graph.astream(cast(Any, input_state), config=config, stream_mode="updates")
            async for event in events:
                for node_name, node_output in event.items():
                    if node_name == "__interrupt__":
                        interrupt_value = node_output[0].value
            
            final_state_res = await graph.aget_state(config)
            final_state = final_state_res.values
        except Exception as e:
            print(f"Error: {e}")
            
    if interrupt_value:
        await prisma.candidate.update(
            where={"id": candidate_id},
            data={"status": "interviewing"}
        )
    elif final_state:
        status = final_state.get("pipeline_status", "complete")
        
        update_data = {"status": status}
            
        if final_state.get("rejection_reason"):
            update_data["rejectionReason"] = final_state["rejection_reason"]
            
        if final_state.get("screening_result"):
            update_data["fitScore"] = final_state["screening_result"].fit_score
        if final_state.get("candidate_profile"):
            profile = final_state["candidate_profile"]
            if hasattr(profile, "model_dump"):
                profile_dict = profile.model_dump()
            else:
                profile_dict = profile
            import json
            update_data.update({
                "name": profile_dict.get("name"),
                "structuredProfile": json.dumps(profile_dict),
                "email": profile_dict.get("email"),
                "phone": profile_dict.get("phone"),
                "skills": profile_dict.get("skills", []),
                "education": profile_dict.get("education", []),
                "rawCvText": profile_dict.get("raw_cv_text")
            })
        await prisma.candidate.update(where={"id": candidate_id}, data=update_data)
        
        # Save evaluation report if available
        evaluation_report = final_state.get("evaluation_report")
        
        # Auto-generate evaluation for rejected candidates if missing
        if not evaluation_report and status == "rejected" and final_state.get("rejection_reason"):
            from app.agent.schemas import EvaluationReport
            evaluation_report = EvaluationReport(
                overall_score=0.0,
                communication_score=0.0,
                technical_score=0.0,
                cultural_fit_score=0.0,
                strengths=[],
                concerns=["Candidate was rejected prior to interview."],
                recommendation="reject",
                summary=final_state["rejection_reason"]
            )
            
        if evaluation_report:
            existing_eval = await prisma.evaluation.find_unique(where={"candidateId": candidate_id})
            eval_data = {
                "candidateId": candidate_id,
                "overallScore": evaluation_report.overall_score,
                "technicalScore": evaluation_report.technical_score,
                "communicationScore": evaluation_report.communication_score,
                "culturalFitScore": evaluation_report.cultural_fit_score,
                "recommendation": evaluation_report.recommendation,
                "summary": evaluation_report.summary,
                "strengths": evaluation_report.strengths,
                "concerns": evaluation_report.concerns,
            }
            if not existing_eval:
                await prisma.evaluation.create(data=eval_data)
            else:
                await prisma.evaluation.update(where={"candidateId": candidate_id}, data=eval_data)
async def resume_pipeline(candidate_id: str, resume_data: Any):
    from langgraph.types import Command
    import os
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    
    db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if db_url:
        db_url = db_url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
    
    async with AsyncPostgresSaver.from_conn_string(db_url) as checkpointer:
        await checkpointer.setup()
        graph = build_recruitment_graph(checkpointer=checkpointer)
        config = {"configurable": {"thread_id": candidate_id}}
        interrupt_value = None
        final_state = None
        try:
            events = graph.astream(Command(resume=resume_data), config=config, stream_mode="updates")
            async for event in events:
                for node_name, node_output in event.items():
                    if node_name == "__interrupt__":
                        interrupt_value = node_output[0].value
                        
            final_state_res = await graph.aget_state(config)
            final_state = final_state_res.values
        except Exception as e:
            print(f"Error resuming graph: {e}")
    
    if interrupt_value:
        await prisma.candidate.update(
            where={"id": candidate_id},
            data={"status": "interviewing"}
        )
    elif final_state:
        status = final_state.get("pipeline_status", "complete")
        
        update_data = {"status": status}
            
        if final_state.get("rejection_reason"):
            update_data["rejectionReason"] = final_state["rejection_reason"]
            
        if final_state.get("screening_result"):
            update_data["fitScore"] = final_state["screening_result"].fit_score
        if final_state.get("candidate_profile"):
            profile = final_state["candidate_profile"]
            if hasattr(profile, "model_dump"):
                profile_dict = profile.model_dump()
            else:
                profile_dict = profile
            import json
            update_data.update({
                "name": profile_dict.get("name"),
                "structuredProfile": json.dumps(profile_dict),
                "email": profile_dict.get("email"),
                "phone": profile_dict.get("phone"),
                "skills": profile_dict.get("skills", []),
                "education": profile_dict.get("education", []),
                "rawCvText": profile_dict.get("raw_cv_text")
            })
        await prisma.candidate.update(where={"id": candidate_id}, data=update_data)
        
        # Save evaluation report if available
        evaluation_report = final_state.get("evaluation_report")
        
        # Auto-generate evaluation for rejected candidates if missing
        if not evaluation_report and status == "rejected" and final_state.get("rejection_reason"):
            from app.agent.schemas import EvaluationReport
            evaluation_report = EvaluationReport(
                overall_score=0.0,
                communication_score=0.0,
                technical_score=0.0,
                cultural_fit_score=0.0,
                strengths=[],
                concerns=["Candidate was rejected prior to interview."],
                recommendation="reject",
                summary=final_state["rejection_reason"]
            )
            
        if evaluation_report:
            existing_eval = await prisma.evaluation.find_unique(where={"candidateId": candidate_id})
            eval_data = {
                "candidateId": candidate_id,
                "overallScore": evaluation_report.overall_score,
                "technicalScore": evaluation_report.technical_score,
                "communicationScore": evaluation_report.communication_score,
                "culturalFitScore": evaluation_report.cultural_fit_score,
                "recommendation": evaluation_report.recommendation,
                "summary": evaluation_report.summary,
                "strengths": evaluation_report.strengths,
                "concerns": evaluation_report.concerns,
            }
            if not existing_eval:
                await prisma.evaluation.create(data=eval_data)
            else:
                await prisma.evaluation.update(where={"candidateId": candidate_id}, data=eval_data)
