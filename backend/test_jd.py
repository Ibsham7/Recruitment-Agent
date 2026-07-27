import asyncio
import json
import os
from app.agent.schemas import ScreeningResult, CandidateProfile
from app.agent.prompts import JD_MATCHER_PROMPTS
from app.agent.config import get_model
from langchain_core.messages import SystemMessage, HumanMessage

async def main():
    from app.agent.nodes.jd_matcher import jd_matcher_node
    jd = "Python, TypeScript, LangChain, Backend"
    profile = CandidateProfile(
        name="Test Candidate",
        total_experience_years=2.0,
        education=["B.S. Computer Science"],
        skills=["Python", "TypeScript", "React"],
        previous_roles=["Backend Developer"],
        key_achievements=["Built REST API"],
        projects=["SmartPulse", "ReviewRoute", "Chatbot", "And 100 more projects..."],
        raw_cv_text="This is a very long text describing candidate history. " * 500
    )
    state = {
        "job_description": jd,
        "candidate_profile": profile,
        "penalties": []
    }
    
    output = await jd_matcher_node(state)
    result = output["screening_result"]
    print(f"\n[SUCCESS] Screening Completed!")
    print(f"Fit Score: {result.fit_score}/100")
    print(f"Decision: {result.decision}")
    print(f"Reasoning Summary: {result.reasoning_summary}")

if __name__ == "__main__":
    asyncio.run(main())
