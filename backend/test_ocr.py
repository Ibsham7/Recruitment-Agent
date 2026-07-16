import time
import asyncio
from app.agent.config import get_model
from langchain_core.messages import HumanMessage
import httpx
import tempfile
import os
import fitz
import base64

async def test():
    url = "https://res.cloudinary.com/db3i07nwj/image/upload/v1784216859/olibqxbxmkrfkrfawmi1.pdf"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30.0, follow_redirects=True)
    
    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    with open(temp_path, "wb") as f:
        f.write(response.content)
        
    doc = fitz.open(temp_path)
    base64_images = []
    for page in doc:
        pix = page.get_pixmap(dpi=150)
        b64 = base64.b64encode(pix.tobytes("jpeg")).decode("utf-8")
        base64_images.append(b64)
    doc.close()
    os.remove(temp_path)

    m = get_model('ocr')
    content_parts = [{"type": "text", "text": "Extract all CV text from these images accurately."}]
    for b64 in base64_images:
        content_parts.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
        
    print("Invoking model...")
    start = time.time()
    try:
        r = await m.ainvoke([HumanMessage(content=content_parts)])
        print('Success!', r.content)
    except Exception as e:
        print('Error:', type(e), e)
    print('Time:', time.time() - start)

asyncio.run(test())
