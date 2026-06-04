"""Background tasks for AI processing."""

import json
import logging
from worker.celery_app import celery_app

logger = logging.getLogger("linear_health.worker")


@celery_app.task(name="worker.tasks.parse_referral_task", bind=True, max_retries=3)
def parse_referral_task(self, referral_id: int, raw_text: str):
    """Background task: parse referral document using Groq AI."""
    from app.logging_utils import set_log_context, clear_log_context

    set_log_context(
        {
            "task_id": self.request.id,
            "task_name": self.name,
            "referral_id": referral_id,
        }
    )
    try:
        from groq import Groq
        import os

        client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        prompt = f"""Extract structured data from this referral document. Return JSON with:
patient_name, date_of_birth, insurance_id, diagnosis, referring_provider, reason_for_referral, urgency, specialty_needed

Document:
---
{raw_text}
---
Return ONLY valid JSON."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1000,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        return {"referral_id": referral_id, "extracted_data": json.loads(content)}
    except Exception as exc:
        logger.error("Referral parse task failed", exc_info=exc)
        self.retry(exc=exc, countdown=30)
    finally:
        clear_log_context()


@celery_app.task(name="worker.tasks.classify_prior_auth_task", bind=True, max_retries=3)
def classify_prior_auth_task(self, pa_id: int, procedure_code: str, procedure_desc: str, diagnosis_code: str, justification: str):
    """Background task: classify prior auth using Groq AI."""
    from app.logging_utils import set_log_context, clear_log_context

    set_log_context(
        {
            "task_id": self.request.id,
            "task_name": self.name,
            "prior_auth_id": pa_id,
            "procedure_code": procedure_code,
        }
    )
    try:
        from groq import Groq
        import os

        client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        prompt = f"""Predict prior authorization outcome. Return JSON with:
predicted_status ("likely_approved"/"likely_denied"/"needs_more_info"), confidence (0-1), generated_justification (2-3 paragraphs)

Procedure: {procedure_code} - {procedure_desc}
Diagnosis: {diagnosis_code}
Justification: {justification or "Not provided"}

Return ONLY valid JSON."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2000,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        return {"pa_id": pa_id, "result": json.loads(content)}
    except Exception as exc:
        logger.error("Prior auth classify task failed", exc_info=exc)
        self.retry(exc=exc, countdown=30)
    finally:
        clear_log_context()
