"""
Groq AI Service — handles LLM inference for referral parsing,
prior authorization classification, and conversational logic.
"""

import json
import logging
from typing import Optional
from groq import Groq
from app.config import settings

logger = logging.getLogger("linear_health.groq")


def _get_client() -> Optional[Groq]:
    """Returns a Groq client if API key is configured."""
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "your_groq_api_key_here":
        logger.warning("Groq API key not configured — AI features disabled")
        return None
    return Groq(api_key=settings.GROQ_API_KEY)


async def parse_referral_document(raw_text: str) -> dict:
    """
    Use Groq LLM to extract structured data from a raw referral document.
    Returns a dict with: patient_name, dob, insurance_id, diagnosis,
    referring_provider, reason_for_referral, urgency.
    """
    client = _get_client()
    if not client:
        return {"error": "AI service unavailable", "raw": raw_text}

    prompt = f"""You are a medical referral data extraction AI. 
Extract the following fields from this referral document and return ONLY valid JSON:
- patient_name (string)
- date_of_birth (string, YYYY-MM-DD)
- insurance_id (string)
- diagnosis (string)
- referring_provider (string)
- reason_for_referral (string)
- urgency (string: "routine", "urgent", "emergent")
- specialty_needed (string)

Document:
---
{raw_text}
---

Return ONLY the JSON object, no other text."""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1000,
        )
        content = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(content, strict=False)
    except Exception as e:
        logger.error("Groq referral parsing failed: %s", e)
        return {"error": str(e), "raw": raw_text}


async def classify_prior_auth(
    procedure_code: str,
    procedure_description: str,
    diagnosis_code: str,
    clinical_justification: str,
) -> dict:
    """
    Use Groq LLM to predict prior auth approval likelihood
    and generate a clinical justification letter.
    """
    client = _get_client()
    if not client:
        return {
            "predicted_status": "unknown",
            "confidence": 0,
            "generated_justification": "AI service unavailable",
        }

    prompt = f"""You are a prior authorization review AI for health insurance.
Given the following procedure and clinical information, provide:
1. predicted_status: "likely_approved" or "likely_denied" or "needs_more_info"
2. confidence: a float between 0 and 1
3. generated_justification: a professional clinical justification letter (2-3 paragraphs)

Procedure Code: {procedure_code}
Procedure: {procedure_description}
Diagnosis Code: {diagnosis_code}
Clinical Justification: {clinical_justification or "Not provided"}

Return ONLY valid JSON with keys: predicted_status, confidence, generated_justification"""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2000,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(content, strict=False)
    except Exception as e:
        logger.error("Groq prior auth classification failed: %s", e)
        return {
            "predicted_status": "error",
            "confidence": 0,
            "generated_justification": f"AI error: {e}",
        }


async def generate_call_summary(transcript: str) -> dict:
    """Summarize a contact center call transcript using Groq."""
    client = _get_client()
    if not client:
        return {"summary": "AI service unavailable", "action_taken": "none"}

    prompt = f"""Summarize this patient call transcript concisely. Return JSON with:
- summary: 1-2 sentence summary
- action_taken: what action was taken or needs to be taken
- escalation_needed: boolean

Transcript:
---
{transcript}
---

Return ONLY valid JSON."""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=500,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(content, strict=False)
    except Exception as e:
        logger.error("Groq call summary failed: %s", e)
        return {"summary": f"Error: {e}", "action_taken": "manual review needed"}
