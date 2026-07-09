import json
from pathlib import Path
from datetime import datetime
from graph import build_recruitment_graph
from typing import Any, cast

def load_jd(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")

def run_candidate(
    cv_filepath: str,
    jd_filepath: str,
    candidate_id: str | None = None
) -> dict:
    """
    Run the full pipeline for one candidate.
    Handles interview interrupts interactively in the terminal.
    """
    if candidate_id is None:
        candidate_id = f"candidate_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    graph = build_recruitment_graph(use_sqlite=True)
    config = {"configurable": {"thread_id": candidate_id}}

    jd = load_jd(jd_filepath)

    initial_state = {
        "cv_filepath": cv_filepath,
        "job_description": jd,
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

    print(f"\n{'='*60}")
    print(f"Starting pipeline for candidate: {candidate_id}")
    print(f"CV: {cv_filepath}")
    print(f"{'='*60}\n")

    # Run the graph — it will pause at interrupt() points
    while True:
        # silence type-checker mismatches by casting to Any where the graph API
        # uses framework-specific runtime types not known to the type checker
        runtime_config = cast(Any, config)
        current_state = graph.get_state(runtime_config)
        input_state = initial_state if getattr(current_state, "values", {}) == {} else None
        events = graph.stream(cast(Any, input_state),
                              config=runtime_config,
                              stream_mode="updates")

        interrupt_value = None
        for event in events:
            for node_name, node_output in event.items():
                if node_name == "__interrupt__":
                    interrupt_value = node_output[0].value
                    break
                if "log" in (node_output or {}):
                    for log_msg in node_output.get("log", []):
                        print(f"  ✓ {log_msg}")

        if interrupt_value is None:
            break  # graph ran to END without interrupting

        # Handle the interrupt
        interrupt_type = interrupt_value.get("type", "interview")

        if interrupt_type == "human_review":
            # Human review gate
            print(f"\n{'─'*60}")
            print("HUMAN REVIEW REQUIRED")
            print(f"Candidate: {interrupt_value['candidate']}")
            print(f"Overall Score: {interrupt_value['evaluation']['overall_score']}/100")
            print(f"Recommendation: {interrupt_value['evaluation']['recommendation'].upper()}")
            print(f"Summary: {interrupt_value['evaluation']['summary']}")
            print(f"Strengths: {', '.join(interrupt_value['evaluation']['strengths'])}")
            print(f"Concerns: {', '.join(interrupt_value['evaluation']['concerns'])}")
            print(f"{'─'*60}")
            human_input = input("Your decision [approve/reject/hold]: ").strip().lower()
            while human_input not in ("approve", "reject", "hold"):
                human_input = input("Enter 'approve', 'reject', or 'hold': ").strip().lower()
            # use runtime_config (cast to Any earlier) to satisfy the graph API
            graph.update_state(runtime_config, None, as_node="human_review")
            graph.invoke(Command(resume=human_input), config=runtime_config)
            break
        else:
            # Interview question
            print(f"\n{'─'*60}")
            print(f"Question {interrupt_value['question_number']}/{interrupt_value['total_questions']}")
            print(f"Category: {interrupt_value['category'].upper()}")
            print(f"\n{interrupt_value['question']}\n")
            answer = input("Candidate answer: ").strip()
            while not answer:
                answer = input("Please provide an answer: ").strip()

            # Resume the graph with the answer
            from langgraph.types import Command
            result = graph.invoke(Command(resume=answer), config=runtime_config)
            initial_state = None  # don't re-send initial state on resume

    # Get final state
    # cast to Any to satisfy type-checker expecting a RunnableConfig
    final_state = graph.get_state(cast(Any, config)).values
    save_report(final_state, candidate_id)
    return final_state


def save_report(state: dict, candidate_id: str):
    """Save JSON state + markdown report to outputs/."""
    outdir = Path("outputs/candidates") / candidate_id
    outdir.mkdir(parents=True, exist_ok=True)

    # Raw JSON
    json_path = outdir / "state.json"
    serializable = {
        k: (v.model_dump() if hasattr(v, "model_dump") else v)
        for k, v in state.items()
    }
    json_path.write_text(json.dumps(serializable, indent=2, default=str))

    # Markdown report
    profile = state.get("candidate_profile")
    screening = state.get("screening_result")
    evaluation = state.get("evaluation_report")
    md_lines = [f"# Candidate Report: {profile.name if profile else candidate_id}"]

    if screening:
        md_lines += [
            f"\n## Screening\n- Score: {screening.fit_score}/100",
            f"- Decision: {screening.decision.upper()}",
            f"- {screening.reasoning}"
        ]
    if evaluation:
        md_lines += [
            f"\n## Interview Evaluation",
            f"- Overall: {evaluation.overall_score}/100",
            f"- Technical: {evaluation.technical_score}/100",
            f"- Communication: {evaluation.communication_score}/100",
            f"- Recommendation: **{evaluation.recommendation.upper()}**",
            f"\n### Summary\n{evaluation.summary}",
            f"\n### Strengths\n" + "\n".join(f"- {s}" for s in evaluation.strengths),
            f"\n### Concerns\n" + "\n".join(f"- {c}" for c in evaluation.concerns),
        ]

    human_decision = state.get("human_decision")
    if human_decision:
        md_lines.append(f"\n## Human Decision: **{human_decision.upper()}**")

    md_lines.append(f"\n## Pipeline Log\n" + "\n".join(f"- {l}" for l in state.get("log", [])))

    (outdir / "report.md").write_text("\n".join(md_lines))
    print(f"\nReport saved: {outdir}/")


if __name__ == "__main__":
    import sys
    cv_path = sys.argv[1] if len(sys.argv) > 1 else "sample_data/cv_alice.pdf"
    jd_path = sys.argv[2] if len(sys.argv) > 2 else "sample_data/jd_software_engineer.md"
    run_candidate(cv_path, jd_path)