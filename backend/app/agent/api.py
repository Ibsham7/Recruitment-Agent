import asyncio
from typing import Any, cast
from app.database import prisma
from prisma import Json
from .graph import build_recruitment_graph
from app.dev_logger import log_event, log_error
from app.agent.state import RecruitmentState

async def start_candidate_pipeline(candidate_id: str, cv_url: str, jd_text: str, checkpointer=None):
    # Load existing profile if it's cached
    candidate = await prisma.candidate.find_unique(where={"id": candidate_id}, include={"campaign": True, "resume": True})
    candidate_profile = None
    hard_filters_config = []
    enable_interviews = True
    interview_config = None
    evaluation_strictness = "moderate"
    if candidate:
        if candidate.resume and candidate.resume.structuredProfile:
            import json
            from app.agent.schemas import CandidateProfile
            profile_data = candidate.resume.structuredProfile
            if isinstance(profile_data, str):
                profile_data = json.loads(profile_data)
            candidate_profile = CandidateProfile(**profile_data)
            
        if candidate.campaign:
            if candidate.campaign.hardFiltersConfig:
                import json
                config_data = candidate.campaign.hardFiltersConfig
                if isinstance(config_data, str):
                    config_data = json.loads(config_data)
                hard_filters_config = config_data
            if hasattr(candidate.campaign, "enableInterviews"):
                enable_interviews = candidate.campaign.enableInterviews
            if hasattr(candidate.campaign, "interviewConfig"):
                interview_config = candidate.campaign.interviewConfig
            if hasattr(candidate.campaign, "evaluationStrictness"):
                evaluation_strictness = candidate.campaign.evaluationStrictness
            
    import os
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    import contextlib
    
    @contextlib.asynccontextmanager
    async def get_checkpointer(cp=None):
        if cp:
            yield cp
        else:
            db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
            if db_url:
                db_url = db_url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
            async with AsyncPostgresSaver.from_conn_string(db_url) as new_cp:
                await new_cp.setup()
                yield new_cp
    
    async with get_checkpointer(checkpointer) as active_checkpointer:
        graph = build_recruitment_graph(checkpointer=active_checkpointer)
        config = {"configurable": {"thread_id": candidate_id}}
        
        initial_state = {
            "cv_filepath": cv_url,
            "job_description": jd_text,
            "candidate_id": candidate_id,
            "candidate_profile": candidate_profile,
            "hard_filters_config": hard_filters_config,
            "penalties": [],
            "enable_interviews": enable_interviews,
            "interview_config": interview_config,
            "jd_matcher_prompt_variant": evaluation_strictness,
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
                    if isinstance(node_output, dict) and "log" in node_output:
                        for log_msg in node_output.get("log", []):
                            log_event(candidate_id, node_name, log_msg)
                    if node_name == "__interrupt__":
                        interrupt_value = node_output[0].value
            
            final_state_res = await graph.aget_state(config)
            final_state = final_state_res.values
        except Exception as e:
            log_error(candidate_id, "start_candidate_pipeline", e)
            await prisma.candidate.update(
                where={"id": candidate_id},
                data={
                    "status": "screening",
                    "rejectionReason": None
                }
            )
            
    if final_state:
        if interrupt_value == "hold_for_review":
            status = "review"
        elif interrupt_value:
            status = "interviewing"
        else:
            status = final_state.get("pipeline_status", "review")
        
        update_data = {"status": status}
            
        if final_state.get("rejection_reason"):
            update_data["rejectionReason"] = final_state["rejection_reason"]
            
        if final_state.get("screening_result"):
            base_score = final_state["screening_result"].fit_score
            semantic_bonus = final_state.get("semantic_score", 0.0)
            update_data["fitScore"] = base_score + semantic_bonus
        elif final_state.get("semantic_score") is not None:
            update_data["fitScore"] = final_state.get("semantic_score")
            
        if final_state.get("candidate_profile"):
            profile = final_state["candidate_profile"]
            if hasattr(profile, "model_dump"):
                profile_dict = profile.model_dump()
            else:
                profile_dict = profile
            update_data.update({
                "name": profile_dict.get("name"),
                "email": profile_dict.get("email"),
                "phone": profile_dict.get("phone"),
                "skills": profile_dict.get("skills", []),
                "education": profile_dict.get("education", [])
            })
            
        # COST_TRACKING: Remove after testing
        if final_state.get("total_cost"):
            update_data["apiCost"] = {"increment": final_state.get("total_cost", 0.0)}
            
        await prisma.candidate.update(where={"id": candidate_id}, data=update_data)
        
        # Save evaluation report if available
        evaluation_report = final_state.get("evaluation_report")
        
        # Auto-generate evaluation for rejected candidates if missing
        if not evaluation_report and final_state.get("screening_result"):
            from app.agent.schemas import EvaluationReport
            res = final_state["screening_result"]
            missing = [req.requirement for req in res.must_have if req.match == "none"]
            matched = [req.requirement for req in res.must_have if req.match != "none"] + [req.requirement for req in res.nice_to_have if req.match != "none"]
            evaluation_report = EvaluationReport(
                overall_score=res.fit_score,
                communication_score=0.0,
                technical_score=0.0,
                cultural_fit_score=0.0,
                strengths=matched,
                concerns=missing,
                recommendation="shortlist" if res.decision == "advance" else res.decision,
                summary=res.reasoning_summary,
                chain_of_thought=f"{res.experience_assessment}\n\n{res.reasoning_summary}"
            )
        elif not evaluation_report and status == "rejected" and final_state.get("rejection_reason"):
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
                "overallScore": evaluation_report.overall_score,
                "technicalScore": evaluation_report.technical_score,
                "communicationScore": evaluation_report.communication_score,
                "culturalFitScore": evaluation_report.cultural_fit_score,
                "recommendation": evaluation_report.recommendation,
                "summary": evaluation_report.summary,
                "strengths": evaluation_report.strengths,
                "concerns": evaluation_report.concerns,
                "chainOfThought": evaluation_report.chain_of_thought,
            }
            if final_state.get("interview_questions"):
                eval_data["interviewQuestions"] = Json([q.dict() for q in final_state["interview_questions"]])
                
            if not existing_eval:
                eval_data["candidate"] = {"connect": {"id": candidate_id}}
                await prisma.evaluation.create(data=eval_data)
            else:
                await prisma.evaluation.update(where={"candidateId": candidate_id}, data=eval_data)
    elif interrupt_value:
        # Fallback if no final_state but interrupted
        fallback_status = "review" if interrupt_value == "hold_for_review" else "interviewing"
        await prisma.candidate.update(
            where={"id": candidate_id},
            data={"status": fallback_status}
        )
async def resume_pipeline(candidate_id: str, resume_data: Any, checkpointer=None):
    from langgraph.types import Command
    import os
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    import contextlib
    
    @contextlib.asynccontextmanager
    async def get_checkpointer(cp=None):
        if cp:
            yield cp
        else:
            db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
            if db_url:
                db_url = db_url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
            async with AsyncPostgresSaver.from_conn_string(db_url) as new_cp:
                await new_cp.setup()
                yield new_cp
    
    async with get_checkpointer(checkpointer) as active_checkpointer:
        graph = build_recruitment_graph(checkpointer=active_checkpointer)
        config = {"configurable": {"thread_id": candidate_id}}
        interrupt_value = None
        final_state = None
        try:
            events = graph.astream(Command(resume=resume_data), config=config, stream_mode="updates")
            async for event in events:
                for node_name, node_output in event.items():
                    if isinstance(node_output, dict) and "log" in node_output:
                        for log_msg in node_output.get("log", []):
                            log_event(candidate_id, node_name, log_msg)
                    if node_name == "__interrupt__":
                        interrupt_value = node_output[0].value
                        
            final_state_res = await graph.aget_state(config)
            final_state = final_state_res.values
        except Exception as e:
            log_error(candidate_id, "resume_pipeline", e)
            await prisma.candidate.update(
                where={"id": candidate_id},
                data={
                    "status": "screening",
                    "rejectionReason": None
                }
            )
    
    if final_state:
        if interrupt_value == "hold_for_review":
            status = "review"
        elif interrupt_value:
            status = "interviewing"
        else:
            status = final_state.get("pipeline_status", "review")
        
        update_data = {"status": status}
            
        if final_state.get("rejection_reason"):
            update_data["rejectionReason"] = final_state["rejection_reason"]
            
        if final_state.get("screening_result"):
            base_score = final_state["screening_result"].fit_score
            semantic_bonus = final_state.get("semantic_score", 0.0)
            update_data["fitScore"] = base_score + semantic_bonus
        elif final_state.get("semantic_score") is not None:
            update_data["fitScore"] = final_state.get("semantic_score")
            
        if final_state.get("candidate_profile"):
            profile = final_state["candidate_profile"]
            if hasattr(profile, "model_dump"):
                profile_dict = profile.model_dump()
            else:
                profile_dict = profile
            update_data.update({
                "name": profile_dict.get("name"),
                "email": profile_dict.get("email"),
                "phone": profile_dict.get("phone"),
                "skills": profile_dict.get("skills", []),
                "education": profile_dict.get("education", [])
            })
            
        # COST_TRACKING: Remove after testing
        if final_state.get("total_cost"):
            update_data["apiCost"] = {"increment": final_state.get("total_cost", 0.0)}
            
        await prisma.candidate.update(where={"id": candidate_id}, data=update_data)
        
        # Save evaluation report if available
        evaluation_report = final_state.get("evaluation_report")
        
        # Auto-generate evaluation for rejected candidates if missing
        if not evaluation_report and final_state.get("screening_result"):
            from app.agent.schemas import EvaluationReport
            res = final_state["screening_result"]
            missing = [req.requirement for req in res.must_have if req.match == "none"]
            matched = [req.requirement for req in res.must_have if req.match != "none"] + [req.requirement for req in res.nice_to_have if req.match != "none"]
            evaluation_report = EvaluationReport(
                overall_score=res.fit_score,
                communication_score=0.0,
                technical_score=0.0,
                cultural_fit_score=0.0,
                strengths=matched,
                concerns=missing,
                recommendation="shortlist" if res.decision == "advance" else res.decision,
                summary=res.reasoning_summary,
                chain_of_thought=f"{res.experience_assessment}\n\n{res.reasoning_summary}"
            )
        elif not evaluation_report and status == "rejected" and final_state.get("rejection_reason"):
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
                "overallScore": evaluation_report.overall_score,
                "technicalScore": evaluation_report.technical_score,
                "communicationScore": evaluation_report.communication_score,
                "culturalFitScore": evaluation_report.cultural_fit_score,
                "recommendation": evaluation_report.recommendation,
                "summary": evaluation_report.summary,
                "strengths": evaluation_report.strengths,
                "concerns": evaluation_report.concerns,
                "chainOfThought": evaluation_report.chain_of_thought,
            }
            if final_state.get("interview_questions"):
                eval_data["interviewQuestions"] = Json([q.dict() for q in final_state["interview_questions"]])
                
            if not existing_eval:
                eval_data["candidate"] = {"connect": {"id": candidate_id}}
                await prisma.evaluation.create(data=eval_data)
            else:
                await prisma.evaluation.update(where={"candidateId": candidate_id}, data=eval_data)
    elif interrupt_value:
        fallback_status = "review" if interrupt_value == "hold_for_review" else "interviewing"
        await prisma.candidate.update(
            where={"id": candidate_id},
            data={"status": fallback_status}
        )
