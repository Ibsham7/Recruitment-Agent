import asyncio
import json
import os
from app.agent.schemas import ScreeningResult, CandidateProfile
from app.agent.prompts import JD_MATCHER_PROMPTS
from app.agent.config import get_model
from langchain_core.messages import SystemMessage, HumanMessage

async def main():
    jd = "Python, TypeScript, LangChain, Backend"
    profile = CandidateProfile(
        name="Test",
        total_experience_years=2.0,
        education=[],
        skills=["Python", "TypeScript", "React"],
        previous_roles=["Dev"],
        key_achievements=[],
        projects=["SmartPulse", "ReviewRoute", "Chatbot", "And 100 more projects..."],
        raw_cv_text="This is a very long text. " * 500
    )
    system_prompt = JD_MATCHER_PROMPTS["default"] + f"\n\nJOB DESCRIPTION:\n{jd}"
    model = get_model("fast")
    structured_model = model.with_structured_output(ScreeningResult, method="json_schema")
    
    profile_dict = profile.model_dump()
    result = await structured_model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"CANDIDATE PROFILE (JSON):\n{json.dumps(profile_dict, indent=2, sort_keys=True)}")
    ])
    
    print("Tokens for Chain of Thought:", len(result.chain_of_thought.split()))
    print("Tokens for CV Summary:", len(result.cv_summary.split()))
    print("Tokens for Reasoning:", len(result.reasoning.split()))
    
    with open("debug_output.json", "w") as f:
        f.write(result.model_dump_json(indent=2))

if __name__ == "__main__":
    asyncio.run(main())
