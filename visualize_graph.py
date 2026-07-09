from graph import build_recruitment_graph

graph = build_recruitment_graph()

try:
    print(graph.get_graph().draw_mermaid())
except Exception as e:
    print("Could not draw mermaid text:", e)

# Save as PNG
try:
    png_data = graph.get_graph().draw_mermaid_png()
    with open("pipeline.png", "wb") as f:
        f.write(png_data)
    print("Graph saved to pipeline.png")
except Exception as e:
    print("Could not generate PNG:", e)