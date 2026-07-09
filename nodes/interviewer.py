# nodes/interviewer.py
from langgraph.types import interrupt
from schemas import InterviewTranscript, InterviewQuestion
from state import RecruitmentState

def interviewer_node(state: RecruitmentState) -> dict:
    """
    Conduct the interview one question at a time using LangGraph interrupt.
    
    Each call to this node asks ONE question and interrupts.
    The graph resumes when the human provides an answer via graph.update_state().
    This node runs in a loop (via a conditional edge back to itself) until
    all questions have been asked.
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

    # interrupt() pauses the graph here and surfaces the value to the caller
    # The graph resumes when graph.update_state() is called externally
    answer = interrupt({
        "question_number": idx + 1,
        "total_questions": len(questions),
        "category": current_q.category,
        "question": current_q.question,
    })

    # When resumed, answer contains what the human typed
    transcript.questions_asked.append(current_q)
    transcript.answers_given.append(str(answer))
    transcript.current_question_index = idx + 1

    return {
        "interview_transcript": transcript,
        "log": [f"Q{idx+1} answered: {str(answer)[:80]}..."]
    }