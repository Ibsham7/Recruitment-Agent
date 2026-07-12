import re

def extract_json(text: str) -> str:
    """Extract a JSON object or array from a string that might contain markdown or conversational text."""
    text = str(text).strip()
    
    # Try finding an object or array
    match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
    if match:
        return match.group(0)
    
    # Fallback to just returning the cleaned text, which might fail json.loads but it's the best we can do
    text = text.strip("```json").strip("```").strip()
    return text
