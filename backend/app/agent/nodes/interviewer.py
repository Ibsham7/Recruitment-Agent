# nodes/interviewer.py
from langgraph.types import interrupt
from app.agent.schemas import InterviewTranscript, InterviewQuestion
from app.agent.state import RecruitmentState
from app.agent.config import get_model
from langchain_core.messages import HumanMessage

async def generate_followup_probe(question_text: str, brief_answer: str) -> str:
    """Generate a polite, targeted follow-up probe asking the candidate to elaborate on key points."""
    prompt = (
        f"You are an interview agent. The candidate was asked:\n'{question_text}'\n\n"
        f"Their response was very brief or missing details:\n'{brief_answer}'\n\n"
        "Generate a single, clear, polite follow-up question (max 25 words) asking them to elaborate, "
        "provide a specific example, or clarify their technical role/decisions."
    )
    try:
        model = get_model("fast")
        res = await model.ainvoke([HumanMessage(content=prompt)])
        return res.content.strip()
    except Exception:
        return "Could you please elaborate with a specific example or more details on your role in this?"

async def interviewer_node(state: RecruitmentState) -> dict:
    """
    Conduct the interview one question at a time using LangGraph interrupt,
    with bounded adaptive probing (max 1 follow-up probe per core question).
    """
    questions: list[InterviewQuestion] = state.get("interview_questions", [])
    transcript = state.get("interview_transcript") or InterviewTranscript()

    # Determine which question to ask next
    idx = transcript.current_question_index

    if idx >= len(questions):
        # All questions asked — signal completion
        return {
            "interview_transcript": transcript,
            "pipeline_status": "running",
            "log": ["Interview complete — all questions asked"]
        }

    current_q = questions[idx]
    probes_asked = transcript.probe_counts.get(idx, 0)

    # interrupt() pauses the graph here and surfaces the value to the caller
    answer = interrupt({
        "question_number": idx + 1,
        "total_questions": len(questions),
        "category": current_q.category,
        "question": current_q.question,
        "is_probe": False
    })

    answer_str = str(answer).strip()

    # Bounded Adaptive Probing: Check if response is short/vague (< 20 words) and no probe asked yet
    words = answer_str.split()
    if len(words) < 20 and probes_asked < 1:
        probe_question = await generate_followup_probe(current_q.question, answer_str)
        transcript.probe_counts[idx] = 1

        # Interrupt again for the adaptive probe
        probe_answer = interrupt({
            "question_number": idx + 1,
            "total_questions": len(questions),
            "category": f"{current_q.category} (Follow-up)",
            "question": probe_question,
            "is_probe": True
        })

        probe_answer_str = str(probe_answer).strip()
        combined_answer = f"{answer_str}\n\n[Follow-up Probe: '{probe_question}']\nAnswer: {probe_answer_str}"
        transcript.questions_asked.append(current_question_with_probe(current_q, probe_question))
        transcript.answers_given.append(combined_answer)
    else:
        transcript.questions_asked.append(current_q)
        transcript.answers_given.append(answer_str)

    transcript.current_question_index = idx + 1

    return {
        "interview_transcript": transcript,
        "log": [f"Q{idx+1} answered: {answer_str[:80]}..."]
    }

def current_question_with_probe(q: InterviewQuestion, probe_text: str) -> InterviewQuestion:
    return InterviewQuestion(
        question=f"{q.question} (Follow-up: {probe_text})",
        category=q.category,
        what_to_look_for=q.what_to_look_for
    )