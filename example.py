from typing import TypedDict, Annotated
from operator import add
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()


# TypedDict defines the shape of your state.
# Every node reads from this, every node returns a partial update to this.
class PipelineState(TypedDict):
    input_text: str           # plain field — gets OVERWRITTEN on each update
    results: Annotated[list, add]  # Annotated with add — gets APPENDED, not overwritten
    step_count: int

# A node is just a function: takes state, returns a partial update dict
def step_one(state: PipelineState) -> dict:
    print(f"Step 1 received: {state['input_text']}")
    return {
        "results": [f"step_one processed: {state['input_text']}"],
        "step_count": state["step_count"] + 1
    }

def step_two(state: PipelineState) -> dict:
    print(f"Step 2 sees results so far: {state['results']}")
    return {
        "results": [f"step_two output"],
        "step_count": state["step_count"] + 1
    }

def step_three(state: PipelineState) -> dict:
    print(f"Step 3 sees {len(state['results'])} results accumulated")
    return {"step_count": state["step_count"] + 1}

# Conditional routing example
def route_after_step_one(state: PipelineState) -> str:
    """The router function — returns the name of the next node."""
    if state["step_count"] > 5:
        return "step_three"   # skip step_two
    return "step_two"         # normal flow


# Build the graph
graph_builder = StateGraph(PipelineState)
graph_builder.add_node("step_one", step_one)
graph_builder.add_node("step_two", step_two)
graph_builder.add_node("step_three", step_three)


# Edges define the order
graph_builder.add_edge(START, "step_one")
graph_builder.add_edge("step_two", "step_three")
graph_builder.add_edge("step_three", END)

graph_builder.add_conditional_edges(
    "step_one",
    route_after_step_one,
    {
        "step_two": "step_two",
        "step_three": "step_three"
    }
)
# Compile — required before running
graph_with_memory = graph_builder.compile(checkpointer=checkpointer)
config = {"configurable": {"thread_id": "test-run-001"}}

# Run it
result = graph_with_memory.invoke({
    "input_text": "hello world",
    "results": [],
    "step_count": 0
}, config=config) # type: ignore

history = list(graph_with_memory.get_state_history(config)) # type: ignore
print(f"\nCheckpoints saved: {len(history)}")
for checkpoint in history:
    print(f"  After node: {checkpoint.next} | step_count={checkpoint.values.get('step_count')}")