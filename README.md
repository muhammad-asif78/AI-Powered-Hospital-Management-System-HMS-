# 🏥 Linear Health — AI-Powered Hospital Management System (HMS)

Linear Health is an enterprise-grade, distributed SaaS platform designed to modernize healthcare operations. The system pairs a high-performance **React + Tailwind** administration dashboard with a **WebRTC-based LiveKit AI Voice receptionist (Sarah)** and an asynchronous **FastAPI + Celery** pipeline for automatic medical document routing and insurance prior authorizations.

---

## 🏗️ Architecture Overview

The system operates as a distributed microservices model consisting of five core planes:

```mermaid
graph TD
    %% Clients
    Patient[📞 Patient Phone / Web Client]
    Clinician[💻 Clinician / Admin Web UI]

    %% Front Facing Proxy
    subgraph Frontend [Presentation & Proxy Gateway]
        UI[React SPA]
        Proxy[Express API Gateway Proxy]
    end

    %% Media Infrastructure
    LK[LiveKit WebRTC SFU Server]

    %% Compute Services
    subgraph Core [Application & Agent Compute]
        API[FastAPI Core Server]
        Agent[LiveKit Voice Agent 'Sarah']
        Worker[Celery Worker Cluster]
    end

    %% State & Brokerage
    subgraph Storage [Datastore & Queue Broker]
        DB[(Postgres 16 DB)]
        Cache[(Redis 7 Cache / Broker)]
    end

    %% Event Flow
    Patient <-->|WebRTC Audio Stream| LK
    LK <-->|Data Channel / RTP| Agent
    Clinician -->|HTTPS / WSS| Proxy
    Proxy -->|REST / JSON| API
    Agent -->|REST / Tool Execution| API
    API -->|Async CRUD / ORM| DB
    API -->|Push Jobs| Cache
    Cache -->|Pull Tasks| Worker
    Worker -->|REST API Updates| API
```

---

## 🚀 Key Features

*   **🎙️ WebRTC Real-Time Receptionist**: AI Receptionist handles multi-turn audio calls, searches patients, registers new records, lists schedules, and routes calls via LiveKit.
*   **📂 Inbound Referral OCR Routing**: Asynchronous parsing of faxed/scanned documents into structured EMR data using Llama-3 (Groq API).
*   **📑 Prior Authorization Predictor**: Machine-learning predictions of prior auth approvals combined with AI-generated justification letters.
*   **📈 Telemetry & Tracing**: Production-grade **Structured JSON Logging** with task-scoped correlation variables (`request_id`, `room_name`, `task_id`) spanning async workers, API routers, and WebRTC streaming sessions.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, Motion (Framer), Lucide Icons |
| **Backend API** | FastAPI, Uvicorn, SQLAlchemy 2.0 (Async), Pydantic v2, Alembic, PostgreSQL 16 |
| **Worker Engine** | Celery 5.4, Redis 7 (Broker & Cache) |
| **Voice Agent** | LiveKit Agents SDK 1.5, Silero VAD, Deepgram Nova 3 (STT), Cartesia Sonic 3.5 (TTS) |
| **LLM Inference** | Google Gemini 2.5 Flash, Groq API (Llama 3.3 70B & 3.1 8b) |

---

## ⚡ Production Improvement: Structured Contextual Logging

### Why It Matters in Real-Time & WebRTC Systems

Debugging WebRTC audio calls and streaming agents is notoriously difficult due to extreme concurrency:
1.  **Distributed Trace Fragmentation**: A single phone call spans browser WebRTC channels, LiveKit SFU signaling, Python agent scripts, FastAPI routers, and Celery background workers.
2.  **Concurrency log-interleaving**: Traditional text logs (e.g. `2026-06-04 INFO: Executing tool`) from concurrent calls interleave in stdout, making it impossible to separate which agent action corresponds to which patient call.
3.  **JSON Searchability**: Structured logs compile timestamps, modules, call IDs, and patient IDs into a unified JSON format. Centralized engines (Datadog, Loki, GCP Logging) index these fields automatically, allowing instant filtering of a complete call lifecycle from audio connection to database commit.

We implemented task-isolated `ContextVar` logs across `backend`, `worker`, and `agent` layers to guarantee context mapping.

### Example Structured Log Output
```json
{
  "timestamp": "2026-06-04T07:58:05.123Z",
  "level": "INFO",
  "logger": "linear_health.agent",
  "message": "Tool execution completed: scheduled appointment",
  "module": "agent",
  "func_name": "schedule_appointment",
  "line_no": 150,
  "room_name": "lh-room-patient-9821",
  "job_id": "AJ_872xYn921a",
  "patient_id": 482,
  "doctor_id": 12
}
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
*   [Docker & Docker Compose](https://docs.docker.com/engine/install/)
*   A LiveKit Server Instance (or LiveKit Cloud Account credentials)
*   External API keys: **Groq API Key**, **Cartesia API Key**, **Deepgram API Key** (or use fallback settings)

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
# Database & Cache Connection
POSTGRES_USER=linearhealth
POSTGRES_PASSWORD=linearhealth_secret
POSTGRES_DB=hospital_management
DATABASE_URL=postgresql+asyncpg://linearhealth:linearhealth_secret@postgres:5432/hospital_management
REDIS_URL=redis://redis:6379/0

# Background Worker Settings
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1

# LiveKit WebRTC credentials
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# AI Models & Engines
GROQ_API_KEY=gsk_your_groq_key
GEMINI_API_KEY=your_gemini_key
CARTESIA_API_KEY=your_cartesia_key
DEEPGRAM_API_KEY=your_deepgram_key
```

### 3. Build and Run the Stack
Deploy the multi-container stack in the background:
```bash
docker-compose up --build -d
```

Verify that all systems are running:
```bash
docker-compose ps
```

---

## 📊 Core API Endpoints

| Endpoint | Method | Role | Payload Context |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Create staff/doctor accounts | Role & access parameters |
| `/api/auth/login` | `POST` | Authenticate & retrieve JWT | OAuth2 password payload |
| `/api/patients/` | `POST` | Register patient demographics | Patient schema JSON |
| `/api/appointments/` | `POST` | Book doctor scheduling | Date, Doctor & Patient ID |
| `/api/referrals/inbound` | `POST` | Queue referral document OCR | Raw document OCR block |
| `/api/prior-auth/` | `POST` | Submit PA validation task | ICD/CPT codes & justification |
| `/api/livekit/token` | `GET` | Retrieve WebRTC Room JWT | Generates short-lived tokens |

---

## 🧪 Verification & Running Tests

Unit tests are written using `pytest` and trace context variables across isolated logging handlers:

```bash
# Run backend logging tests using the virtual environment
PYTHONPATH=./backend .venv/bin/pytest backend/app/tests/test_logging.py
```
