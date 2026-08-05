import re
import json

def clean_surrogates(s: str) -> str:
    """Sanitize string to remove unpaired UTF-16 surrogates that break UTF-8 encoding/JSON dumps."""
    if not s:
        return ""
    return str(s).encode("utf-8", errors="replace").decode("utf-8")

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

MODEL_PRICING = {
    "google/gemini-2.5-flash": {"input": 0.075 / 1_000_000, "output": 0.30 / 1_000_000},
    "google/gemini-2.5-flash-lite": {"input": 0.075 / 1_000_000, "output": 0.30 / 1_000_000},
    "text-embedding-3-small": {"input": 0.020 / 1_000_000, "output": 0.0},
}

def extract_cost_and_tokens(response, model_name: str = "google/gemini-2.5-flash") -> tuple[float, dict]:
    """Extract input and output tokens from a LangChain / OpenRouter response and compute cost."""
    input_tokens = 0
    output_tokens = 0

    try:
        raw_msg = response.get("raw") if isinstance(response, dict) else response
        
        # 1. Check LangChain usage_metadata attribute or dict key
        usage_meta = getattr(raw_msg, "usage_metadata", None) or (raw_msg.get("usage_metadata") if isinstance(raw_msg, dict) else None)
        if isinstance(usage_meta, dict):
            input_tokens = usage_meta.get("input_tokens", 0) or usage_meta.get("prompt_tokens", 0)
            output_tokens = usage_meta.get("output_tokens", 0) or usage_meta.get("completion_tokens", 0)

        # 2. Fallback to response_metadata["token_usage"]
        if input_tokens == 0 and output_tokens == 0:
            resp_meta = getattr(raw_msg, "response_metadata", None) or (raw_msg.get("response_metadata") if isinstance(raw_msg, dict) else None)
            if isinstance(resp_meta, dict):
                token_usage = resp_meta.get("token_usage") or resp_meta.get("usage", {})
                if isinstance(token_usage, dict):
                    input_tokens = token_usage.get("prompt_tokens", 0) or token_usage.get("input_tokens", 0)
                    output_tokens = token_usage.get("completion_tokens", 0) or token_usage.get("output_tokens", 0)

        # 3. If response_metadata itself has direct token keys
        if input_tokens == 0 and output_tokens == 0:
            resp_meta = getattr(raw_msg, "response_metadata", None) or (raw_msg.get("response_metadata") if isinstance(raw_msg, dict) else None)
            if isinstance(resp_meta, dict):
                input_tokens = resp_meta.get("prompt_tokens", 0)
                output_tokens = resp_meta.get("completion_tokens", 0)
    except Exception:
        pass

    rates = MODEL_PRICING.get(model_name, MODEL_PRICING["google/gemini-2.5-flash"])
    cost = (input_tokens * rates["input"]) + (output_tokens * rates["output"])

    token_info = {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": round(cost, 6)
    }
    return round(cost, 6), token_info

def extract_cost(response, model_name: str = "google/gemini-2.5-flash") -> float:
    cost, _ = extract_cost_and_tokens(response, model_name)
    return cost

