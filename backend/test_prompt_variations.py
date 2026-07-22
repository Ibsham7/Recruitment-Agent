import asyncio
import os
import json
from pathlib import Path
from app.agent.graph import build_recruitment_graph

# Replace with the provided JD
JD_TEXT = """We are looking for an AI Developer to design, build, and deploy intelligent applications and machine learning infrastructure. In this role, you will bridge the gap between advanced deep learning models and production-ready software. You will focus heavily on large language model (LLM) orchestration, multi-agent frameworks, and building the robust backend architecture required to support scalable AI features.
Key Responsibilities
Agentic Workflow Development: Design and implement autonomous multi-agent execution loops and orchestration pipelines for complex problem-solving.
Backend & API Engineering: Build production-grade, scalable backend services and APIs to serve ML models and manage data flow between shared stores.
Model Integration & Optimization: Integrate various cloud-hosted multi-model platforms and manage API connectivity, rate limits, and contextual token scaling.
Advanced AI Architectures: Implement and maintain Retrieval-Augmented Generation (RAG) systems and apply parameter-efficient fine-tuning techniques to adapt open-weights models.
Infrastructure & Tooling: Establish reliable machine learning production pipelines and utilize open-source connectivity standards to allow models to interact with external tools and databases.
Required Qualifications
Programming Languages: Strong proficiency in Python and TypeScript/Node.js.
AI & LLM Frameworks: Hands-on experience with orchestration and agent frameworks such as LangChain, LangGraph, CrewAI, AutoGen, or the Model Context Protocol (MCP).
Backend Technologies: Experience with modern backend web architectures (e.g., NestJS, Express) and relational databases (PostgreSQL) using ORMs like Prisma or Drizzle.
Applied Machine Learning: Solid understanding of deep learning optimization strategies, post-training alignment, and architectures like LoRA (Low-Rank Adaptation) and GRPO.
Cloud & Model Ops: Experience utilizing platforms like OpenRouter to manage API keys, track billing structures, and test diverse production-grade model architectures.
Preferred Qualifications
A strong portfolio of independent, agent-based proof-of-concept projects demonstrating practical AI engineering skills.
An understanding of low-level hardware optimizations, compute thermal management, and cache organization mechanics for local model deployments.
A strong mathematical foundation in vector calculus and linear algebra."""

from app.agent.nodes.cv_parser import extract_pdf_text, CV_PARSER_SYSTEM
from app.agent.prompts import JD_MATCHER_PROMPTS
from app.agent.utils import extract_json
from app.agent.config import get_model
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.schemas import CandidateProfile, ScreeningResult
import traceback

PROMPT_VARIANTS = ["default", "strict", "lenient"]

async def main():
    test_pdfs_dir = Path("test pdfs")
    if not test_pdfs_dir.exists():
        print(f"Directory {test_pdfs_dir} not found.")
        return

    pdf_files = list(test_pdfs_dir.glob("*.pdf"))
    print(f"Found {len(pdf_files)} PDFs.")

    results = []
    Path("outputs").mkdir(exist_ok=True)
    
    model = get_model("fast")

    for pdf_file in pdf_files:
        print(f"\n{'='*50}\nProcessing {pdf_file.name}\n{'='*50}")
        pdf_results = {"file": pdf_file.name, "variants": {}}
        
        # 1. Parse CV first (once per PDF to save time and tokens)
        print("  -> Extracting and Parsing CV...")
        try:
            raw_text, pre_parsed_profile = await extract_pdf_text(str(pdf_file.absolute()))
            if pre_parsed_profile:
                profile_data = pre_parsed_profile
            else:
                response = await model.ainvoke([
                    SystemMessage(content=CV_PARSER_SYSTEM),
                    HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
                ])
                profile_data = json.loads(extract_json(response.content), strict=False)
            
            if not profile_data.get("name"): profile_data["name"] = "Unknown Candidate"
            profile_data["raw_cv_text"] = raw_text
            for k in ["total_experience_years", "skills", "previous_roles", "education", "projects"]:
                if k not in profile_data: profile_data[k] = 0.0 if k == "total_experience_years" else []
                
            profile = CandidateProfile(**profile_data)
            print(f"     Parsed Profile: {profile.name}")
        except Exception as e:
            print(f"     Failed to parse CV: {e}")
            for v in PROMPT_VARIANTS:
                pdf_results["variants"][v] = {"error": f"CV Parse Error: {e}"}
            results.append(pdf_results)
            continue
        
        # 2. Run JD Matcher Variations
        for variant in PROMPT_VARIANTS:
            print(f"  -> Testing variant: {variant}")
            base_prompt = JD_MATCHER_PROMPTS.get(variant, JD_MATCHER_PROMPTS["default"])
            system_prompt = base_prompt + f"\n\nJOB DESCRIPTION:\n{JD_TEXT}"
            
            try:
                response = await model.ainvoke([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=f"CANDIDATE PROFILE (JSON):\n{json.dumps(profile.model_dump(), indent=2)}")
                ])
                raw_json = extract_json(response.content)
                res_dict = json.loads(raw_json, strict=False)
                
                # Handle cases where model mistakenly returns chain_of_thought as a list
                if "chain_of_thought" in res_dict and isinstance(res_dict["chain_of_thought"], list):
                    res_dict["chain_of_thought"] = "\n".join(str(x) for x in res_dict["chain_of_thought"])
                    
                res = ScreeningResult(**res_dict)
                
                pdf_results["variants"][variant] = {
                    "score": res.fit_score,
                    "decision": res.decision,
                    "chain_of_thought": res.chain_of_thought,
                    "reasoning": res.reasoning,
                    "matched": res.matched_requirements,
                    "missing": res.missing_requirements
                }
                print(f"     Score: {res.fit_score}, Decision: {res.decision}")
            except Exception as e:
                print(f"     Failed: {e}")
                pdf_results["variants"][variant] = {"error": str(e)}

        results.append(pdf_results)

    # Output to markdown
    md_content = "# JD Matcher Prompt Variations Evaluation\n\n"
    for r in results:
        md_content += f"## Candidate CV: `{r['file']}`\n"
        for variant, v_data in r['variants'].items():
            md_content += f"### Variant: {variant.title()}\n"
            if "error" in v_data:
                md_content += f"**Error:** {v_data['error']}\n\n"
                continue
            
            md_content += f"- **Score:** {v_data['score']}/100\n"
            md_content += f"- **Decision:** `{v_data['decision'].upper()}`\n"
            md_content += f"- **Matched Requirements:** {len(v_data.get('matched', []))}\n"
            md_content += f"- **Missing Requirements:** {len(v_data.get('missing', []))}\n\n"
            
            md_content += f"**Chain of Thought:**\n> {v_data['chain_of_thought']}\n\n"
            md_content += f"**Reasoning:**\n{v_data['reasoning']}\n\n"
            
        md_content += "---\n\n"

    with open("outputs/jd_matcher_evaluation_results.md", "w", encoding="utf-8") as f:
        f.write(md_content)
        
    print("Evaluation completed. Results saved to outputs/jd_matcher_evaluation_results.md")

if __name__ == "__main__":
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
