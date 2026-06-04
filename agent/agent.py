"""
Linear Health AI Contact Center — Voice Agent
Full clinical agent: Registrations, Referrals, Prior Auth, Scheduling.
Uses LiveKit Agents 1.5.x with:
  STT  → Groq Whisper (via livekit-plugins-openai / Groq base_url)
  LLM  → Groq llama-3.3-70b-versatile
  TTS  → OpenAI TTS (via Groq tts-1 endpoint)
  VAD  → Silero
"""

import os
import logging
import asyncio
from dotenv import load_dotenv

import httpx
from livekit.agents import JobContext, WorkerOptions, cli, Agent, AgentSession, llm
from livekit.agents import inference as lk_inference
from livekit.plugins import silero
from logging_utils import setup_agent_logging, set_agent_context

load_dotenv()

logger = logging.getLogger("linear_health.agent")

BACKEND_URL  = os.getenv("BACKEND_URL", "http://backend:8000")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

AGENT_EMAIL    = "ai-agent@linearhealth.com"
AGENT_PASSWORD = "change_me_in_production"

# ─────────────────────────────────────────────────────────────────────────────
# Backend Auth helper
# ─────────────────────────────────────────────────────────────────────────────

_auth_token: str | None = None

async def _ensure_auth() -> str | None:
    global _auth_token
    if _auth_token:
        return _auth_token
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{BACKEND_URL}/api/auth/login",
                json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
            )
            if resp.status_code != 200:
                resp = await client.post(
                    f"{BACKEND_URL}/api/auth/register",
                    json={
                        "email": AGENT_EMAIL,
                        "password": AGENT_PASSWORD,
                        "full_name": "AI Contact Center Agent",
                        "role": "admin",
                    },
                )
            _auth_token = resp.json().get("access_token")
            return _auth_token
        except Exception as exc:
            logger.error("Backend auth error: %s", exc)
            return None


async def api_call(method: str, endpoint: str, json_body=None) -> dict:
    token = await _ensure_auth()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await getattr(client, method)(
            f"{BACKEND_URL}{endpoint}",
            headers=headers,
            json=json_body,
        )
        if resp.status_code < 300:
            return resp.json()
        return {"error": resp.text, "status": resp.status_code}

# ─────────────────────────────────────────────────────────────────────────────
# Clinical Tool Class
# ─────────────────────────────────────────────────────────────────────────────

class HospitalTools:

    @llm.function_tool()
    async def register_patient(
        self,
        first_name: str,
        last_name: str,
        date_of_birth: str,
        gender: str,
        email: str,
        phone: str,
    ) -> str:
        """Register a brand-new patient into the clinic system."""
        import random
        # Auto-generate a unique medical record number required by backend schema
        mrn = f"MRN-{random.randint(1000, 9999)}"
        # Convert gender to lowercase as expected by backend Pydantic GenderEnum
        gender_enum = gender.lower() if gender else "other"
        
        result = await api_call("post", "/api/patients/", json_body={
            "first_name": first_name,
            "last_name": last_name,
            "date_of_birth": date_of_birth,
            "gender": gender_enum,
            "email": email,
            "phone": phone,
            "medical_record_number": mrn,
        })
        if "id" in result:
            return f"Patient registered successfully. Patient ID: {result['id']}, MRN: {result['medical_record_number']}"
        return f"Registration failed: {result.get('detail', result)}"

    @llm.function_tool()
    async def search_patients(self, name: str) -> str:
        """Search for existing patients by first or last name to get their Patient ID and MRN."""
        result = await api_call("get", f"/api/patients/?search={name}")
        if isinstance(result, list) and result:
            return "\n".join(
                f"{p['first_name']} {p['last_name']} (Patient ID: {p['id']}, MRN: {p.get('medical_record_number','?')}, DOB: {p['date_of_birth']})"
                for p in result[:5]
            )
        return "No patients found matching that name."

    @llm.function_tool()
    async def list_doctors(self, specialty: str = None) -> str:
        """List doctors in the hospital, optionally filtered by clinical specialty, to get their Doctor ID."""
        endpoint = "/api/doctors/"
        if specialty:
            endpoint += f"?specialty={specialty}"
        result = await api_call("get", endpoint)
        if isinstance(result, list) and result:
            return "\n".join(
                f"Dr. {d['first_name']} {d['last_name']} (Doctor ID: {d['id']}, Specialty: {d['specialty']})"
                for d in result[:10]
            )
        return "No doctors found."

    @llm.function_tool()
    async def schedule_appointment(
        self, patient_id: int, doctor_id: int, appointment_date: str, reason: str
    ) -> str:
        """Schedule an appointment for a patient with a specific doctor."""
        result = await api_call("post", "/api/appointments/", json_body={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "appointment_date": appointment_date,
            "reason": reason,
        })
        if "id" in result:
            return f"Appointment booked for {appointment_date}. Appointment ID: {result['id']}"
        return f"Scheduling failed: {result.get('detail', result)}"

    @llm.function_tool()
    async def create_inbound_referral(
        self,
        patient_id: int,
        referring_provider: str,
        referral_date: str,
        reason: str,
        clinical_notes: str = "",
    ) -> str:
        """Process an inbound referral from another provider."""
        result = await api_call("post", "/api/referrals/inbound", json_body={
            "patient_id": patient_id, "referring_provider": referring_provider,
            "referral_date": referral_date, "reason": reason,
            "clinical_notes": clinical_notes,
        })
        if "id" in result:
            return f"Inbound referral created. ID: {result['id']}"
        return f"Failed: {result.get('detail', result)}"

    @llm.function_tool()
    async def create_outbound_referral(
        self,
        patient_id: int,
        target_specialty: str,
        target_provider: str,
        reason: str,
    ) -> str:
        """Refer a patient to an outside specialist."""
        result = await api_call("post", "/api/referrals/outbound", json_body={
            "patient_id": patient_id, "target_specialty": target_specialty,
            "target_provider": target_provider, "reason": reason,
        })
        if "id" in result:
            return f"Outbound referral submitted. ID: {result['id']}"
        return f"Failed: {result.get('detail', result)}"

    @llm.function_tool()
    async def submit_prior_auth(
        self,
        patient_id: int,
        doctor_id: int,
        insurance_provider_id: int,
        procedure_code: str,
        procedure_description: str,
        diagnosis_code: str,
        clinical_justification: str = "",
    ) -> str:
        """Submit a prior authorization request to the patient's insurer."""
        result = await api_call("post", "/api/prior-auth/", json_body={
            "patient_id": patient_id, "doctor_id": doctor_id,
            "insurance_provider_id": insurance_provider_id,
            "procedure_code": procedure_code,
            "procedure_description": procedure_description,
            "diagnosis_code": diagnosis_code,
            "clinical_justification": clinical_justification,
        })
        if "id" in result:
            return f"Prior auth submitted. ID: {result['id']}, Status: {result['status']}"
        return f"Failed: {result.get('detail', result)}"

    @llm.function_tool()
    async def get_dashboard_stats(self) -> str:
        """Retrieve a summary of the clinic's current operational stats."""
        result = await api_call("get", "/api/dashboard/stats")
        if "total_patients" in result:
            return (
                f"Clinic stats: {result['total_patients']} patients, "
                f"{result['total_doctors']} doctors, "
                f"{result.get('appointments_today', 0)} appointments today, "
                f"{result.get('pending_referrals', 0)} referrals pending."
            )
        return "Could not fetch dashboard stats."

# ─────────────────────────────────────────────────────────────────────────────
# Agent System Prompt
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are Sarah, the AI medical receptionist for Linear Health clinic. 
Speak naturally, warmly, and concisely as if on a real phone call.

Your capabilities:
1. Register new patients (collect: first/last name, date of birth, gender, email, phone).
2. Search and look up existing patients by name to retrieve their Patient ID.
3. List doctors to retrieve their Doctor ID.
4. Schedule appointments with doctors.
5. Process inbound referrals from other providers.
6. Submit outbound referrals to outside specialists.
7. Submit prior authorization requests.
8. Answer general questions about clinic stats.

Guidelines:
- IMPORTANT: Before scheduling any appointment, creating referrals, or prior auths, you MUST use `search_patients` (or `register_patient` if new) to retrieve the correct integer `Patient ID`, and use `list_doctors` to retrieve the correct integer `Doctor ID`. Do NOT guess or make up these IDs (do not use 1234 or placeholders).
- Ask for one piece of information at a time.
- Confirm important details (dates, names) by reading them back.
- Always be empathetic — patients may be unwell or stressed.
- Keep responses under 3 sentences when possible.
- If you cannot help, politely say you will connect them to a human staff member.
"""

# ─────────────────────────────────────────────────────────────────────────────
# LiveKit Agent Entry Point
# ─────────────────────────────────────────────────────────────────────────────

class ClinicalAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=SYSTEM_PROMPT,
            tools=llm.find_function_tools(HospitalTools()),
        )


async def entrypoint(ctx: JobContext) -> None:
    set_agent_context({
        "room_name": ctx.room.name,
        "job_id": ctx.job.id,
    })
    logger.info("Starting Linear Health agent for room: %s", ctx.room.name)

    # Authenticate with backend
    await _ensure_auth()

    # ── STT: LiveKit Inference Deepgram Nova 3 (fast, high-quality, medical-compatible) ──
    stt = lk_inference.STT(
        model="deepgram/nova-3",
    )

    # ── LLM: LiveKit Inference Gemini 2.5 Flash (low latency, high intelligence) ──
    llm_model = lk_inference.LLM(
        model="google/gemini-2.5-flash",
        extra_kwargs={"temperature": 0.4},
    )

    # ── TTS: LiveKit Inference Cartesia Sonic 3.5 (lifelike receptionist voice) ──
    tts = lk_inference.TTS(
        model="cartesia/sonic-3.5",
        voice="f786b574-daa5-4673-aa0c-cbe3e8534c02",  # Katie (natural English female)
    )

    # ── VAD: Silero (local, no external call needed) ─────────────────────
    vad = silero.VAD.load(
        min_speech_duration=0.05,
        min_silence_duration=0.55,       # comfortable pause before agent responds
        activation_threshold=0.55,
    )

    # Guard: avoid double-agent in same room
    for p in ctx.room.remote_participants.values():
        if "agent" in p.identity.lower():
            logger.warning("Agent already present in room %s — exiting.", ctx.room.name)
            return

    # Connect to the LiveKit room
    await ctx.connect()

    # Build the AgentSession (pipeline: VAD → STT → LLM → TTS)
    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm_model,
        tts=tts,
    )

    # Greet the patient when they join
    @ctx.room.on("participant_connected")
    def _greet(participant):
        if not getattr(ctx, "_greeted", False) and "patient" in participant.identity.lower():
            ctx._greeted = True
            logger.info("Patient joined, sending greeting.")
            session.say(
                "Hello! Thank you for calling Linear Health. "
                "I'm Sarah, your AI medical receptionist. How can I help you today?",
                allow_interruptions=True,
            )

    # Start the agent pipeline
    await session.start(agent=ClinicalAgent(), room=ctx.room)

    # Also greet if patient was already in room when agent joined
    for p in ctx.room.remote_participants.values():
        if "patient" in p.identity.lower() and not getattr(ctx, "_greeted", False):
            ctx._greeted = True
            await asyncio.sleep(0.8)
            session.say(
                "Hello! Thank you for calling Linear Health. "
                "I'm Sarah, your AI medical receptionist. How can I help you today?",
                allow_interruptions=True,
            )
            break


# ─────────────────────────────────────────────────────────────────────────────
# Worker entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    setup_agent_logging(logging.INFO)
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="linear-health-agent",
        )
    )
