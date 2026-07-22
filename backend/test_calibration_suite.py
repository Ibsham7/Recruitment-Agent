import asyncio
import os
import json
from pathlib import Path
from app.agent.nodes.cv_parser import cv_parser_node
from app.agent.nodes.hard_filters import hard_filters_node
from app.agent.nodes.jd_matcher import jd_matcher_node
from app.agent.utils import extract_json
from app.agent.config import get_model
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.schemas import CandidateProfile

VARIANTS = ["lenient", "default", "strict"]

BENCHMARK_EXPECTED = {
    "Daniel Okafor": {"lenient": 96, "moderate": 92, "strict": 88},
    "Meera Iyer": {"lenient": 84, "moderate": 74, "strict": 62},
    "Thomas Reyes": {"lenient": 68, "moderate": 52, "strict": 34},
    "Priya Nair": {"lenient": 50, "moderate": 32, "strict": 15},
    "Jake Sullivan": {"lenient": 30, "moderate": 15, "strict": 5},
}

async def run_test():
    test_dir = Path(__file__).parent / "test"
    jd_path = test_dir / "JD_Senior_Backend_Engineer.md"
    pdfs_dir = test_dir / "pdfs"

    with open(jd_path, "r", encoding="utf-8") as f:
        jd_text = f.read()

    pdf_files = sorted(list(pdfs_dir.glob("*.pdf")))
    print(f"\n=======================================================")
    print(f"   RUNNING AGENTIC WORKFLOW CALIBRATION TEST SUITE     ")
    print(f"=======================================================\n")
    print(f"Found {len(pdf_files)} test CVs in {pdfs_dir.name}\n")

    results_table = []
    model = get_model("fast")

    for pdf_file in pdf_files:
        print(f"Processing: {pdf_file.name}...")
        parse_state = {"cv_filepath": str(pdf_file.absolute()), "candidate_id": "test_cand"}
        parse_res = await cv_parser_node(parse_state)
        profile = parse_res["candidate_profile"]
        cand_name = profile.name

        cand_results = {"name": cand_name, "file": pdf_file.name, "scores": {}, "decisions": {}}

        for variant in VARIANTS:
            state = {
                "candidate_profile": profile,
                "job_description": jd_text,
                "hard_filters_config": [],
                "penalties": [],
                "jd_matcher_prompt_variant": variant,
                "enable_interviews": True
            }

            # Node 1: Hard Filters
            hf_res = await hard_filters_node(state)
            if hf_res.get("pipeline_status") == "rejected":
                cand_results["scores"][variant] = 0
                cand_results["decisions"][variant] = "REJECT (Hard Filter)"
                continue

            state.update(hf_res)

            # Node 2: JD Matcher
            jd_res = await jd_matcher_node(state)
            scr = jd_res["screening_result"]
            cand_results["scores"][variant] = scr.fit_score
            cand_results["decisions"][variant] = scr.decision.upper()

        results_table.append(cand_results)

    # Print Evaluation Summary
    print("\n" + "="*80)
    print(f"{'CANDIDATE':<20} | {'LENIENT':<12} | {'MODERATE':<12} | {'STRICT':<12} | {'MONOTONIC?':<10}")
    print("="*80)

    for r in results_table:
        l_score = r["scores"].get("lenient", 0)
        m_score = r["scores"].get("default", 0)
        s_score = r["scores"].get("strict", 0)

        # Monotonic check: Lenient >= Moderate >= Strict
        is_monotonic = "YES" if (l_score >= m_score >= s_score) else "NO (FAIL)"

        l_str = f"{l_score} ({r['decisions'].get('lenient', '')})"
        m_str = f"{m_score} ({r['decisions'].get('default', '')})"
        s_str = f"{s_score} ({r['decisions'].get('strict', '')})"

        print(f"{r['name']:<20} | {l_str:<12} | {m_str:<12} | {s_str:<12} | {is_monotonic:<10}")

    print("="*80 + "\n")

    # Save Markdown Report
    report_md = "# Workflow Calibration Test Results\n\n"
    report_md += "| Candidate | Lenient Score | Moderate Score | Strict Score | Monotonic Order? | Benchmark Target (L/M/S) |\n"
    report_md += "|---|---|---|---|---|---|\n"
    for r in results_table:
        l = r["scores"].get("lenient", 0)
        m = r["scores"].get("default", 0)
        s = r["scores"].get("strict", 0)
        mono = "PASSED" if (l >= m >= s) else "FAILED"
        name = r["name"]
        target = BENCHMARK_EXPECTED.get(name, {})
        target_str = f"{target.get('lenient','-')} / {target.get('moderate','-')} / {target.get('strict','-')}" if target else "N/A"
        report_md += f"| {name} | {l} ({r['decisions'].get('lenient','')}) | {m} ({r['decisions'].get('default','')}) | {s} ({r['decisions'].get('strict','')}) | **{mono}** | {target_str} |\n"

    out_file = test_dir / "calibration_test_results.md"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(report_md)
    print(f"Saved calibration report to: {out_file}\n")

if __name__ == "__main__":
    asyncio.run(run_test())
