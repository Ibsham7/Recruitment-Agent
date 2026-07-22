import re
import json

def extract_json(text: str) -> str:
    """Extract a JSON object or array from a string that might contain markdown or conversational text."""
    text = str(text).strip()
    
    # First try to extract from a markdown code block if present
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        text = match.group(1).strip()
        
    # Find the first '{' or '['
    start_obj = text.find('{')
    start_arr = text.find('[')
    
    start_idx = -1
    if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        start_idx = start_obj
    elif start_arr != -1:
        start_idx = start_arr
        
    if start_idx != -1:
        try:
            # raw_decode parses a valid JSON document and returns the parsed object and the end index.
            # We slice the text to return just the valid JSON string.
            obj, end_idx = json.JSONDecoder().raw_decode(text[start_idx:])
            return text[start_idx:start_idx + end_idx]
        except json.JSONDecodeError:
            pass
            
    # Fallback to just returning the cleaned text
    text = text.strip("```json").strip("```").strip()
    return text

# COST_TRACKING: Remove after testing
def extract_cost(response) -> float:
    try:
        raw_msg = response.get("raw") if isinstance(response, dict) else response
        if raw_msg and hasattr(raw_msg, "response_metadata"):
            return raw_msg.response_metadata.get("token_usage", {}).get("cost", 0.0)
    except Exception:
        pass
    return 0.0
