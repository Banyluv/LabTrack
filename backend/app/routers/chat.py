import os

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.security import get_current_user

router = APIRouter()

SYSTEM_PROMPT = (
    "You are an AI assistant for a consumable inventory management system used by facility staff and administrators.\n"
    "The user may ask about navigation, how to record stock receipts, use daily usage logs, approve requests, or "
    "understand batch and expiry reports.\n"
    "Provide a short, helpful answer and mention relevant pages when appropriate."
)


@router.post("")
async def ask_question(body: dict, user=Depends(get_current_user)):
    question = body.get("question")
    if not question or not isinstance(question, str):
        raise HTTPException(status_code=400, detail="Question is required.")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured on server.")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": question},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 450,
                },
            )

        if response.status_code >= 400:
            print(f"Chat assistant error {response.status_code} {response.text}")
            raise HTTPException(status_code=500, detail="Unable to get a response from the AI assistant.")

        data = response.json()
        answer = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        return {"answer": answer or "I could not generate an answer at this time."}
    except HTTPException:
        raise
    except Exception as error:
        print(f"Chat assistant error {error}")
        raise HTTPException(status_code=500, detail="Unable to get a response from the AI assistant.")
