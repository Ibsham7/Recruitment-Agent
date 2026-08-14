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
    "google/gemini-3.1-flash-lite": {"input": 0.25 / 1_000_000, "output": 1.50 / 1_000_000},
    "google/gemini-2.5-flash": {"input": 0.25 / 1_000_000, "output": 1.50 / 1_000_000},
    "google/gemini-2.5-flash-lite": {"input": 0.25 / 1_000_000, "output": 1.50 / 1_000_000},
    "text-embedding-3-small": {"input": 0.020 / 1_000_000, "output": 0.0},
}

def extract_cost_and_tokens(response, model_name: str = "google/gemini-3.1-flash-lite") -> tuple[float, dict]:
    """Extract input and output tokens from a LangChain / OpenRouter response and compute cost."""
    input_tokens = 0
    output_tokens = 0

    try:
        raw_msg = response.get("raw") if isinstance(response, dict) and "raw" in response else response

        def _get_val(obj, key1: str, key2: str = None):
            if isinstance(obj, dict):
                v = obj.get(key1, 0)
                if not v and key2:
                    v = obj.get(key2, 0)
                return v or 0
            elif hasattr(obj, key1):
                v = getattr(obj, key1, 0)
                if not v and key2:
                    v = getattr(obj, key2, 0)
                return v or 0
            return 0

        # 1. Check usage_metadata attribute or dict key
        usage_meta = getattr(raw_msg, "usage_metadata", None) or (raw_msg.get("usage_metadata") if isinstance(raw_msg, dict) else None)
        if usage_meta:
            input_tokens = _get_val(usage_meta, "input_tokens", "prompt_tokens")
            output_tokens = _get_val(usage_meta, "output_tokens", "completion_tokens")

        # 2. Fallback to response_metadata["token_usage"] or response_metadata["usage"]
        if input_tokens == 0 and output_tokens == 0:
            resp_meta = getattr(raw_msg, "response_metadata", None) or (raw_msg.get("response_metadata") if isinstance(raw_msg, dict) else None)
            if resp_meta:
                token_usage = _get_val(resp_meta, "token_usage") or _get_val(resp_meta, "usage")
                if token_usage:
                    input_tokens = _get_val(token_usage, "prompt_tokens", "input_tokens")
                    output_tokens = _get_val(token_usage, "completion_tokens", "output_tokens")

        # 3. If response_metadata itself has direct token keys
        if input_tokens == 0 and output_tokens == 0:
            resp_meta = getattr(raw_msg, "response_metadata", None) or (raw_msg.get("response_metadata") if isinstance(raw_msg, dict) else None)
            if resp_meta:
                input_tokens = _get_val(resp_meta, "prompt_tokens", "input_tokens")
                output_tokens = _get_val(resp_meta, "completion_tokens", "output_tokens")

        # 4. Direct response object/dict keys
        if input_tokens == 0 and output_tokens == 0:
            input_tokens = _get_val(raw_msg, "prompt_tokens", "input_tokens")
            output_tokens = _get_val(raw_msg, "completion_tokens", "output_tokens")
    except Exception:
        pass

    rates = MODEL_PRICING.get(model_name, MODEL_PRICING["google/gemini-3.1-flash-lite"])
    cost = (input_tokens * rates["input"]) + (output_tokens * rates["output"])

    token_info = {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": round(cost, 6)
    }
    return round(cost, 6), token_info

def extract_cost(response, model_name: str = "google/gemini-3.1-flash-lite") -> float:
    cost, _ = extract_cost_and_tokens(response, model_name)
    return cost

