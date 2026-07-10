# batch_run.py
import json
from pathlib import Path
from run import run_candidate

candidates = [
    ("sample_data/cv_alice.pdf", "alice"),
    ("sample_data/cv_bob.pdf", "bob"),
    ("sample_data/cv_charlie.pdf", "charlie"),
]

JD = "sample_data/jd_software_engineer.md"

results = []
for cv_path, cid in candidates:
    print(f"\nProcessing: {cid}")
    final_state = run_candidate(cv_path, JD, cid)
    results.append({
        "candidate": cid,
        "screening_score": final_state.get("screening_result", {}).get("fit_score") if final_state.get("screening_result") else "N/A",
        "evaluation_score": final_state.get("evaluation_report", {}).get("overall_score") if final_state.get("evaluation_report") else "N/A",
        "recommendation": final_state.get("evaluation_report", {}).get("recommendation") if final_state.get("evaluation_report") else "rejected_at_screening",
        "human_decision": final_state.get("human_decision", "N/A"),
        "status": final_state.get("pipeline_status")
    })

# Print comparison table
print("\n\n=== BATCH RESULTS ===")
print(f"{'Candidate':<15} {'Screen':>7} {'Eval':>6} {'AI Rec':>10} {'Human':>8}")
print("─" * 55)
for r in results:
    print(f"{r['candidate']:<15} {str(r['screening_score']):>7} {str(r['evaluation_score']):>6} {str(r['recommendation']):>10} {str(r['human_decision']):>8}")