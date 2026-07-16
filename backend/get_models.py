import requests
import json

response = requests.get('https://openrouter.ai/api/v1/models')
models = response.json().get('data', [])

# Sort by prompt pricing
def get_price(m):
    try:
        return float(m.get('pricing', {}).get('prompt', 0))
    except:
        return 0

models.sort(key=get_price)

good_models = []
for m in models:
    # filter out free models
    if get_price(m) == 0: continue
    
    # Check context length
    context = m.get('context_length', 0)
    name = m.get('id', '')
    
    # We want reliable cheap models (e.g., Llama 3 8B, Haiku, Mixtral, Qwen)
    if 'free' not in name.lower() and context >= 8000:
        good_models.append(m)
        if len(good_models) >= 15: break

print('Cheapest reliable models (>8k context, non-free):')
for m in good_models:
    price = get_price(m) * 1000000
    comp_price = float(m.get('pricing', {}).get('completion', 0)) * 1000000
    print(f"{m['id']} - Context: {m.get('context_length')} - Prompt: ${price:.3f}/M - Comp: ${comp_price:.3f}/M")
