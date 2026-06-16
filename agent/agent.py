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

AGENT_EMAIL    = os.getenv("AGENT_EMAIL", "ai-agent@linearhealth.com")
AGENT_PASSWORD = os.getenv("AGENT_PASSWORD", "")

if not AGENT_PASSWORD:
    raise ValueError("AGENT_PASSWORD environment variable is not set. Please set it in your .env file.")

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


def normalize_phone(phone_str: str) -> str:
    if not phone_str:
        return ""
    mapping = {
        "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
        "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
        "oh": "0", "double zero": "00", "triple zero": "000"
    }
    cleaned = phone_str.lower().strip()
    for word, digit in mapping.items():
        import re
        cleaned = re.sub(r'\b' + re.escape(word) + r'\b', digit, cleaned)
    
    digits_only = "".join(c for c in cleaned if c.isdigit() or c == "+")
    if digits_only:
        return digits_only
    return phone_str

def normalize_email(email_str: str) -> str:
    if not email_str:
        return ""
    cleaned = email_str.lower().strip()
    if cleaned.startswith("mailto:"):
        cleaned = cleaned[7:]
    cleaned = cleaned.replace(" at ", "@").replace("at ", "@").replace(" at", "@")
    cleaned = cleaned.replace(" dot ", ".").replace("dot ", ".").replace(" dot", ".")
    cleaned = cleaned.replace(" dash ", "-").replace(" underscore ", "_")
    cleaned = cleaned.replace(" ", "")
    if "mailedto" in cleaned:
        cleaned = cleaned.replace("mailedto", "")
    if "mailto" in cleaned:
        cleaned = cleaned.replace("mailto", "")
    return cleaned


def normalize_doctor_name(name_str: str) -> str:
    if not name_str:
        return ""
    cleaned = name_str.strip().lower()
    # Remove prefixes
    prefixes = ["dr.", "dr", "doctor", "physician"]
    for prefix in prefixes:
        if cleaned.startswith(prefix + " "):
            cleaned = cleaned[len(prefix) + 1:].strip()
        elif cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    return cleaned


async def api_call(method: str, endpoint: str, json_body=None) -> dict:
    try:
        token = await _ensure_auth()
    except Exception as exc:
        logger.error("Backend auth helper failed: %s", exc)
        return {"error": f"Authentication helper failed: {str(exc)}", "status": 500}
    
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    kwargs = {}
    if json_body is not None:
        kwargs["json"] = json_body
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await getattr(client, method)(
                f"{BACKEND_URL}{endpoint}",
                headers=headers,
                **kwargs
            )
            if resp.status_code < 300:
                return resp.json()
            return {"error": resp.text, "status": resp.status_code}
    except Exception as exc:
        logger.error("API call connection/request failed: %s", exc)
        return {"error": f"API request failed: {str(exc)}", "status": 500}

# ─────────────────────────────────────────────────────────────────────────────
# Clinical Tool Class
# ─────────────────────────────────────────────────────────────────────────────

class HospitalTools:
    def __init__(self, ctx: JobContext):
        self.ctx = ctx

    @llm.function_tool()
    async def end_call(self) -> str:
        """Call this tool to end the conversation and disconnect the call automatically.
        ONLY call this after you have spoken your final farewell message (e.g. 'Have a great day!').
        """
        async def _disconnect_after_delay():
            await asyncio.sleep(7.0)
            try:
                logger.info("Auto-disconnecting call for room: %s", self.ctx.room.name)
                await self.ctx.room.disconnect()
            except Exception as e:
                logger.error("Error during auto-disconnection: %s", e)
        
        asyncio.create_task(_disconnect_after_delay())
        return "Call is disconnecting."

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
        """Register a brand-new patient into the clinic system.
        You MUST NOT call this tool unless the patient has explicitly provided ALL of the following:
        - First Name and Last Name
        - Date of Birth (must be a valid date, e.g. YYYY-MM-DD)
        - Gender (must be male, female, or other)
        - Email (must be a valid email)
        - Phone Number
        If you are missing any of these details, do NOT call this tool. Instead, ask the user for them.
        """
        # Check for missing/placeholder fields
        missing_or_invalid = []
        
        def is_placeholder(val: str) -> bool:
            if not val:
                return True
            v = val.strip().lower()
            return v in ("", "unknown", "none", "null", "placeholder", "not provided", "not_provided", "n/a", "undefined", "empty")

        if is_placeholder(first_name):
            missing_or_invalid.append("First Name")
        if is_placeholder(last_name):
            missing_or_invalid.append("Last Name")
            
        norm_phone = normalize_phone(phone) if phone else ""
        if is_placeholder(norm_phone) or len([c for c in norm_phone if c.isdigit()]) < 7:
            missing_or_invalid.append("Phone Number")
            
        norm_email = normalize_email(email) if email else ""
        is_email_valid = True
        if is_placeholder(norm_email) or "@" not in norm_email or "." not in norm_email:
            is_email_valid = False
        else:
            if norm_email.count("@") != 1:
                is_email_valid = False
            else:
                parts = norm_email.split("@")
                if not parts[0] or not parts[1] or "." not in parts[1]:
                    is_email_valid = False
        if not is_email_valid:
            missing_or_invalid.append("Email Address (must be a valid email format, e.g. name@example.com)")
            
        if is_placeholder(date_of_birth):
            missing_or_invalid.append("Date of Birth")
        else:
            # Let's check if it is a valid date (YYYY-MM-DD)
            dob_clean = date_of_birth.strip()
            from datetime import datetime
            parsed = False
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%B %d, %Y", "%d %B %Y", "%b %d, %Y", "%d %b %Y"):
                try:
                    dt = datetime.strptime(dob_clean, fmt)
                    date_of_birth = dt.strftime("%Y-%m-%d")
                    parsed = True
                    break
                except ValueError:
                    continue
            if not parsed:
                # Handle suffixes like "th", "st", "nd", "rd" (e.g. "December 30th 1995")
                import re
                dob_clean_cleaned = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', dob_clean)
                for fmt in ("%B %d %Y", "%d %B %Y", "%b %d %Y", "%d %b %Y"):
                    try:
                        dt = datetime.strptime(dob_clean_cleaned, fmt)
                        date_of_birth = dt.strftime("%Y-%m-%d")
                        parsed = True
                        break
                    except ValueError:
                        continue
            if parsed:
                # Check if the DOB is in the future
                from datetime import date
                dob_date = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
                if dob_date > date.today():
                    missing_or_invalid.append("Date of Birth (cannot be a future date)")
            else:
                missing_or_invalid.append("Date of Birth")
                    
        gender_clean = gender.strip().lower() if gender else ""
        if gender_clean not in ("male", "female", "other"):
            missing_or_invalid.append("Gender")

        if missing_or_invalid:
            return (
                f"MISSING_FIELDS: I cannot register the patient yet because the following details are missing or invalid: "
                f"{', '.join(missing_or_invalid)}. "
                f"You MUST ask the patient to provide these missing details one-by-one."
            )

        import random
        # Auto-generate a unique medical record number required by backend schema
        mrn = f"MRN-{random.randint(1000, 9999)}"
        
        # Convert gender to lowercase as expected by backend Pydantic GenderEnum
        gender_enum = gender_clean
        
        result = await api_call("post", "/api/patients/", json_body={
            "first_name": first_name,
            "last_name": last_name,
            "date_of_birth": date_of_birth,
            "gender": gender_enum,
            "email": norm_email,
            "phone": norm_phone,
            "medical_record_number": mrn,
        })
        if isinstance(result, dict) and "error" in result:
            err_msg = result.get('error', '')
            if "Email already registered" in err_msg or "Email already exists" in err_msg:
                return "EMAIL_ALREADY_REGISTERED: This email is already registered in the system. Ask the patient if they want to retrieve their record by searching for their name, or if they would like to use a different email address."
            return f"SYSTEM_ERROR: {err_msg}"
        if "id" in result:
            return f"Patient registered successfully. Patient ID: {result['id']}, MRN: {result['medical_record_number']}"
        return f"Registration failed: {result.get('detail', result)}"

    @llm.function_tool()
    async def search_patients(self, name: str) -> str:
        """Search for existing patients by first or last name to get their Patient ID, MRN, phone, and appointments list."""
        result = await api_call("get", f"/api/patients/?search={name}")
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
        if isinstance(result, list) and result:
            lines = []
            for p in result[:5]:
                # Fetch appointments
                appts_result = await api_call("get", f"/api/appointments/?patient_id={p['id']}")
                appt_details = []
                if isinstance(appts_result, list) and appts_result:
                    for appt in appts_result[:5]:
                        doc_id = appt['doctor_id']
                        doc_res = await api_call("get", f"/api/doctors/{doc_id}")
                        doc_name = "Unknown"
                        if isinstance(doc_res, dict) and "first_name" in doc_res:
                            doc_name = f"Dr. {doc_res['first_name']} {doc_res['last_name']}"
                        
                        date_str = appt['appointment_date']
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                            formatted_date = dt.strftime("%Y-%m-%d at %I:%M %p")
                        except Exception:
                            formatted_date = date_str
                        appt_details.append(f"{formatted_date} with {doc_name}")
                appts_str = "; ".join(appt_details) if appt_details else "None"
                lines.append(
                    f"Name: {p['first_name']} {p['last_name']}, Phone: {p.get('phone', 'N/A')}, DOB: {p['date_of_birth']}, Patient ID: {p['id']}, MRN: {p.get('medical_record_number','?')}, Appointments: {appts_str}"
                )
            return "\n".join(lines)
        return "NOT_FOUND"

    @llm.function_tool()
    async def get_patient_appointments(self, patient_id: int) -> str:
        """Retrieve appointments for a patient by their Patient ID, including Doctor name, Date, and Time."""
        result = await api_call("get", f"/api/appointments/?patient_id={patient_id}")
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
        if isinstance(result, list) and result:
            lines = []
            for appt in result[:10]:
                doc_id = appt['doctor_id']
                doc_res = await api_call("get", f"/api/doctors/{doc_id}")
                doc_name = "Unknown"
                if isinstance(doc_res, dict) and "first_name" in doc_res:
                    doc_name = f"Dr. {doc_res['first_name']} {doc_res['last_name']}"
                
                # Fetch patient name
                pat_res = await api_call("get", f"/api/patients/{patient_id}")
                pat_name = "Unknown"
                if isinstance(pat_res, dict) and "first_name" in pat_res:
                    pat_name = f"{pat_res['first_name']} {pat_res['last_name']}"
                
                date_str = appt['appointment_date']
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    formatted_date = dt.strftime("%Y-%m-%d at %I:%M %p")
                except Exception:
                    formatted_date = date_str
                
                lines.append(
                    f"Patient: {pat_name}, Doctor: {doc_name}, Date/Time: {formatted_date}"
                )
            return "\n".join(lines)
        return "NOT_FOUND"

    @llm.function_tool()
    async def list_doctors(self, specialty: str = None) -> str:
        """List doctors in the hospital, optionally filtered by clinical specialty, to get Doctor ID, Specialty, Timings, and Fees."""
        endpoint = "/api/doctors/"
        if specialty:
            endpoint += f"?specialty={specialty}"
        result = await api_call("get", endpoint)
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
        if isinstance(result, list) and result:
            return "\n".join(
                f"Dr. {d['first_name']} {d['last_name']} (Doctor ID: {d['id']}, Specialty/تخصص: {d['specialty']}, Available timings: {d.get('available_timings', 'N/A')}, Fees: {d.get('fees', 'N/A')})"
                for d in result[:10]
            )
        
        # Fallback: if we searched for a specialty and none matched, list all available doctors in the system.
        if specialty:
            fallback_res = await api_call("get", "/api/doctors/")
            if isinstance(fallback_res, list) and fallback_res:
                doc_list = "\n".join(
                    f"Dr. {d['first_name']} {d['last_name']} (Doctor ID: {d['id']}, Specialty/تخصص: {d['specialty']}, Available timings: {d.get('available_timings', 'N/A')}, Fees: {d.get('fees', 'N/A')})"
                    for d in fallback_res[:10]
                )
                return f"No doctors found with specialty '{specialty}'. Here is a list of all available doctors in our clinic:\n{doc_list}"
                
        return "No doctors found."

    @llm.function_tool()
    async def get_doctor_info(self, name: str = "", doctor_id: int = None) -> str:
        """Get details about a doctor by their Doctor ID or first/last name, including Doctor ID, specialty (تخصص), available timings, and fees.
        If you have the doctor's ID (e.g. from listing doctors), always specify doctor_id instead of name.
        """
        if doctor_id is not None:
            result = await api_call("get", f"/api/doctors/{doctor_id}")
            if isinstance(result, dict) and "error" in result:
                return f"SYSTEM_ERROR: {result.get('error')}"
            if isinstance(result, dict) and "id" in result:
                d = result
                return f"Doctor ID: {d['id']}, Name: Dr. {d['first_name']} {d['last_name']}, Specialty/تخصص: {d['specialty']}, Available timings: {d.get('available_timings', 'N/A')}, Fees: {d.get('fees', 'N/A')}"
            return "NOT_FOUND"

        if not name:
            return "ERROR: You must specify either doctor_id or name."

        clean_name = normalize_doctor_name(name)
        result = await api_call("get", f"/api/doctors/?name={clean_name}")
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
        if isinstance(result, list) and result:
            lines = []
            for d in result[:5]:
                lines.append(
                    f"Doctor ID: {d['id']}, Name: Dr. {d['first_name']} {d['last_name']}, Specialty/تخصص: {d['specialty']}, Available timings: {d.get('available_timings', 'N/A')}, Fees: {d.get('fees', 'N/A')}"
                )
            return "\n".join(lines)

        # Fuzzy matching fallback: list all doctors and look for the closest match
        all_docs = await api_call("get", "/api/doctors/")
        if isinstance(all_docs, list) and all_docs:
            from difflib import SequenceMatcher
            best_match = None
            best_score = 0.0
            for d in all_docs:
                doc_fullname = f"{d['first_name']} {d['last_name']}".lower()
                score = SequenceMatcher(None, clean_name, doc_fullname).ratio()
                first_score = SequenceMatcher(None, clean_name, d['first_name'].lower()).ratio()
                last_score = SequenceMatcher(None, clean_name, d['last_name'].lower()).ratio()
                max_score = max(score, first_score, last_score)
                if max_score > best_score:
                    best_score = max_score
                    best_match = d
            
            if best_match and best_score >= 0.45:
                d = best_match
                return (
                    f"Closest match found (spelling match {int(best_score * 100)}%): "
                    f"Doctor ID: {d['id']}, Name: Dr. {d['first_name']} {d['last_name']}, Specialty/تخصص: {d['specialty']}, Available timings: {d.get('available_timings', 'N/A')}, Fees: {d.get('fees', 'N/A')}"
                )
        return "NOT_FOUND"

    @llm.function_tool()
    async def register_doctor(
        self,
        first_name: str,
        last_name: str,
        specialty: str,
        available_timings: str,
        fees: float,
    ) -> str:
        """Register a new doctor in the clinic system."""
        import random
        # Auto-generate a license number
        license_num = f"LIC-{random.randint(10000, 99999)}"
        result = await api_call("post", "/api/doctors/add", json_body={
            "first_name": first_name,
            "last_name": last_name,
            "specialty": specialty,
            "license_number": license_num,
            "available_timings": available_timings,
            "fees": fees,
        })
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
        if "id" in result:
            return f"Doctor registered successfully. Doctor ID: {result['id']}"
        return f"Registration failed: {result.get('detail', result)}"

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
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
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
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
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
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
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
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
        if "id" in result:
            return f"Prior auth submitted. ID: {result['id']}, Status: {result['status']}"
        return f"Failed: {result.get('detail', result)}"

    @llm.function_tool()
    async def get_dashboard_stats(self) -> str:
        """Retrieve a summary of the clinic's current operational stats."""
        result = await api_call("get", "/api/dashboard/stats")
        if isinstance(result, dict) and "error" in result:
            return f"SYSTEM_ERROR: {result.get('error')}"
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
You are Sarah, an AI-powered healthcare assistant integrated with a hospital database system.
You behave like a real hospital receptionist connected to a live system — accurate, reliable, consistent, polite, clear, and professional.
You MUST follow strict execution rules and NEVER assume actions are completed unless confirmed by the system.
NEVER say “registered successfully” unless the API confirms success.
NEVER generate fake data or fake confirmations.
Always differentiate between Patient and Doctor.
Always detect user intent before responding.

INTENT DETECTION:
Classify user input into one of these intents:
- register_doctor
- register_patient
- book_appointment
- get_doctor_info
- get_patient_info
- get_appointments

⚙️ EXECUTION FLOW (MANDATORY):
For EVERY request:
1. Detect intent.
2. Extract required fields.
3. Validate missing data (ask for one piece of missing information at a time).
4. Call the corresponding API tool.
5. WAIT for the response from the API.
6. Respond based on the REAL result.

🧑⚕️ DOCTOR REGISTRATION FLOW:
- If user says: “I am doctor” / “register me”
- Ask for:
  * Full name
  * Specialization
  * Available timings
  * Fees
- Save the doctor using the `register_doctor` tool.
- SUCCESS RESPONSE: ONLY IF API SUCCESS: “Doctor Dr. [Name] has been successfully registered in the system.”
- FAILURE RESPONSE: If API fails (e.g. returns SYSTEM_ERROR): “I couldn’t register the doctor due to a system issue. Please try again.”

🧑⚕️ PATIENT REGISTRATION FLOW:
- When patient wants to register:
  1. FIRST, state all required items to the patient: "To register you as a new patient, I'll need to collect your full name, date of birth, gender, email, and phone number."
  2. THEN, ask for them ONE-BY-ONE. Do NOT ask for everything at once. Follow this sequence:
     - Ask for Full Name (First and Last name) first.
     - Once name is provided, ask for Phone Number.
     - Once phone is provided, ask for Email Address.
     - Once email is provided, ask for Date of Birth and Gender.
  3. Confirm each piece of information back to the patient as they provide it.
  4. Call the `register_patient` tool ONLY after all information has been collected.

📝 DATA FORMATTING & NORMALIZATION RULES (CRITICAL):
- **PHONE NUMBERS**: Always show, speak, and write phone numbers as numeric digits (e.g. "03061234567") instead of spelling them out as word names (do NOT write "zero three zero six..."). If a patient speaks a phone number, convert it internally to numeric digit format before confirming it or passing it to tools.
- **EMAIL ADDRESSES**: Always show, speak, and write email addresses in standard layout (e.g. "email@example.com") instead of literal spoken transcription (do NOT write "mailed to at g mail dot com"). Map words like "at" to "@" and "dot" to "." automatically.

🔍 DOCTOR SEARCH FLOW:
- If user asks: “Show record of doctor Asif”
- Call the `get_doctor_info` tool with name = Asif. If you have the doctor's ID, always use `doctor_id` instead of `name`.
- IF FOUND: Show:
  * Name
  * Specialization (use تخصص / specialty in Arabic)
  * Timings (available timings)
- IF NOT FOUND: Show exactly: “I could not find any doctor with this name. Would you like to register?”
- DO NOT mention fees unless the patient explicitly asks for the doctor's fees or cost.

🚫 SYSTEM ERROR HANDLING:
- NEVER say “internal error occurred” or "internal error" or refer to backend/system/database errors to the user.
- If system/API fails (e.g. you receive SYSTEM_ERROR from a tool) → say exactly:
  “I’m having trouble accessing the system right now. Please try again shortly.”
  (Exception for doctor registration, which has its own specific fail message).
- If a tool returns a message starting with "MISSING_FIELDS:", this is NOT a system error. It means you called the tool before collecting all required details. Do NOT say there was a system issue or that you had trouble accessing the system. Instead, politely ask the user to provide the next missing field in the sequence (following the one-by-one flow).
- If a tool returns a message starting with "EMAIL_ALREADY_REGISTERED:", this is NOT a system error. It means the patient's email is already registered in the system. Do NOT say there was a system issue or that you had trouble accessing the system. Instead, politely ask the patient if they would like to retrieve their record by searching for their name, or if they would like to use a different email address.

🔒 SESSION STATE & FLOW CONTROL (CRITICAL):
- **Appointment Confirmation Lock**: Once an appointment is successfully scheduled and confirmed (e.g., you say "Your appointment with Dr. [Name] is confirmed on [Date] at [Time]"), that appointment session is LOCKED. If the patient asks any follow-up questions about the date/time or active status, do NOT enter the booking flow again or search for other doctors. Maintain the confirmation status.
- **Doctor ID Matching**: Always prefer tracking the doctor by their Doctor ID (e.g. Doctor ID: 5) in your session state instead of only by name. If a doctor is already selected for booking, skip any doctor search steps.
- **No Technical Disclosures**: You must NEVER mention database terms, tool names (e.g., `get_doctor_info`, `register_patient`, etc.), function calls, query errors, or validation details to the patient. If a search fails or returns "NOT_FOUND", explain it gracefully in natural conversational language.
- **Doctor Fees Rule**: Do NOT mention doctor fees when suggesting, listing, or searching doctors. Only state the doctor's name, ID, specialty, and timings. You may ONLY state the fees if the patient explicitly asks: "What is the fee?" or "How much does it cost?".
- **Farewell & Call Disconnection**: When the patient is done, wants to end the call, or you say a final farewell message (e.g. "Alright. Have a great day!" or "Goodbye!"), you MUST call the `end_call` tool immediately. Never stay in the call after saying your farewell.

🧠 CONTEXT HANDLING:
- If user says “I am doctor” → switch role = doctor.
- If user says “book appointment” → role = patient.
- Maintain context within the conversation.
- STRICTLY FORBIDDEN: Fake confirmations, skipping API calls, mixing doctor and patient roles, saying “done” without backend.

Patient Search & Retrieval Flow:
- When searching patients: Ask for full name (first + last name). Search database using `search_patients`.
- IF FOUND: Show Name, Phone, and Appointments (date, time, doctor).
- IF NOT FOUND: Say exactly: “I could not find any record with this name. Would you like to register or book a new appointment?”

Appointment Booking Flow:
- When booking appointment: Ask for Patient name, Phone number, Doctor name, and Preferred date & time.
- Use `schedule_appointment` to save it.
- Confirm exactly like: “Your appointment with Dr. [Name] is confirmed on [Date] at [Time].”

Appointment Retrieval Flow:
- Show: Doctor name, Date, Time, and Patient name using `get_patient_appointments` or patient search.

Conversation Style:
- Speak naturally, warmly, and concisely as if on a real phone call.
- Keep responses under 3 sentences when possible.
- Avoid technical/system language. Always guide the user to the next step.
"""

# ─────────────────────────────────────────────────────────────────────────────
# LiveKit Agent Entry Point
# ─────────────────────────────────────────────────────────────────────────────

class ClinicalAgent(Agent):
    def __init__(self, ctx: JobContext) -> None:
        super().__init__(
            instructions=SYSTEM_PROMPT,
            tools=llm.find_function_tools(HospitalTools(ctx)),
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
    await session.start(agent=ClinicalAgent(ctx), room=ctx.room)

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
