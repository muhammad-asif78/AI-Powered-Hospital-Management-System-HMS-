# 🏥 Linear Health — AI-Powered Hospital Management System (HMS)


Linear Health is an enterprise-grade, distributed SaaS platform designed to modernize healthcare operations. The system pairs a high-performance **React + Tailwind** administration dashboard with a **WebRTC-based LiveKit AI Voice receptionist (Sarah)** and an asynchronous **FastAPI + Celery** pipeline for automatic medical document routing, insurance prior authorizations, and clinical telemetry.

---

<p align="center">
  <img src="https://img.shields.io/badge/commits-GPG%20signed-brightgreen?logo=git&style=for-the-badge" alt="GPG Signed" />
  <img src="https://img.shields.io/badge/python-3.12-blue?logo=python&style=for-the-badge" alt="Python 3.12" />
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&style=for-the-badge" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&style=for-the-badge" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&style=for-the-badge" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&style=for-the-badge" alt="Docker-Compose" />
  <img src="https://img.shields.io/badge/LiveKit-WebRTC-F43F5E?logo=webrtc&style=for-the-badge" alt="LiveKit WebRTC" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License MIT" />
</p>

---

## 🖥️ Platform Interfaces

### 🎙️ AI Voice Agent Panel (Dark Theme)
The clinical voice receptionist handles WebRTC audio connections, processes real-time natural language through structured tool parameters, and visualizes system state.
![AI Voice Agent](assets/ai_voice_agent.png)

### 📊 Hospital Census Dashboard (Light Theme)
The interactive administrative console maps physical ward allocations, logs admissions, tracks specialties, and manages AI auto-routing pipelines.
![Hospital Census Dashboard](assets/hospital_census_dashboard.png)

---

## 🏗️ Microservice Architecture

The platform operates as a distributed system consisting of five core planes: a real-time WebRTC audio broker, static representation routing, core application computes, transactional datastores, and asynchronous task workers.

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

## ⚡ Key Features

*   **🎙️ WebRTC Real-Time AI Receptionist**: Conducts multi-turn audio calls with patients, registers demographics, searches records, schedules appointments, and routes clinical alerts using LiveKit Agents.
*   **📊 Dynamic Bed Allocation Layout**: Live interactive map of physical ICU, General Medical, and Trauma wards with status coloring (Occupied, Free, Reserved).
*   **📂 Inbound Referral OCR Routing**: Asynchronously processes scanned fax documentation, extracting structured EMR payloads with Llama-3 (Groq LLM).
*   **📑 Prior Authorization Predictor**: Leverages AI models to estimate prior-authorization approvals based on CPT/ICD codes, generating customized justification letters.
*   **📈 Contextual Tracing (Correlation ID)**: Propagates a unified thread-safe `request_id` context spanning the React client, API routes, Redis broker, Celery worker cluster, and LiveKit WebRTC agent.

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

## 💻 Code Setup Highlights

### 1. LiveKit Voice Agent Entrypoint (`agent/agent.py`)
This configuration establishes the conversational pipeline (VAD $\rightarrow$ STT $\rightarrow$ LLM $\rightarrow$ TTS) and exposes database integrations as tools using LLM function decorators.

```python
from livekit.agents import JobContext, WorkerOptions, Agent, AgentSession, llm, cli
from livekit.plugins import silero
from livekit.agents import inference as lk_inference

class ClinicalAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="You are Sarah, the AI medical receptionist for Linear Health.",
            tools=llm.find_function_tools(HospitalTools()),
        )

async def entrypoint(ctx: JobContext) -> None:
    # 1. Initialize STT (Deepgram Nova 3), LLM (Gemini 2.5), and TTS (Cartesia)
    stt = lk_inference.STT(model="deepgram/nova-3")
    llm_model = lk_inference.LLM(model="google/gemini-2.5-flash")
    tts = lk_inference.TTS(model="cartesia/sonic-3.5", voice="katie-female-id")
    vad = silero.VAD.load()

    # 2. Establish Room Session
    await ctx.connect()
    session = AgentSession(vad=vad, stt=stt, llm=llm_model, tts=tts)

    # 3. Start Agent loop
    await session.start(agent=ClinicalAgent(), room=ctx.room)
```

### 2. Contextual Structured Logging (`backend/app/logging_utils.py`)
To isolate parallel calls and trace them across distributed Celery workers and WebRTC rooms, we wrap standard logging structures inside Python `ContextVar` variables.

```python
import logging
from contextvars import ContextVar
from datetime import datetime, timezone

LOG_CONTEXT: ContextVar[dict] = ContextVar("log_context", default={})

class StructuredJSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Merge task-scoped request/call contexts
        payload.update(LOG_CONTEXT.get())
        return json.dumps(payload)
```

---

## ⚙️ Installation & Configuration

### 1. Prerequisites
*   [Docker & Docker Compose](https://docs.docker.com/engine/install/)
*   A LiveKit Server (or free [LiveKit Cloud Account](https://cloud.livekit.io/))
*   External APIs: **Groq API Key**, **Cartesia API Key**, **Deepgram API Key**, **Gemini API Key**

### 2. Configure Environment Variables
Create a `.env` file in the root workspace directory matching the variables below:

```env
# Database & Cache Connections
POSTGRES_USER=linearhealth
POSTGRES_PASSWORD=linearhealth_secret
POSTGRES_DB=hospital_management
DATABASE_URL=postgresql+asyncpg://linearhealth:linearhealth_secret@postgres:5432/hospital_management
REDIS_URL=redis://redis:6379/0

# Asynchronous Broker Settings
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

### 3. Running via Docker Compose (Recommended)
Compile the entire microservice stack and deploy in the background:
```bash
docker-compose up --build -d
```
Verify that all containers are healthy:
```bash
docker-compose ps
```

---

## 🛠️ Local Development Execution

If you prefer to run services individually for interactive debugging:

### 1. Backend Core API
Initialize database tables, run standard Alembic migrations, and spin up the FastAPI listener:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -c "import app.database as db; import asyncio; asyncio.run(db.init_db())"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. LiveKit AI Voice Agent
Activate the agent environment and run in dev mode:
```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python agent.py dev
```

### 3. Asynchronous Celery Worker
Deploy Celery listeners to start processing queued document OCR routing tasks:
```bash
cd backend
celery -A app.services.worker worker --loglevel=info
```

### 4. React Frontend Admin Dashboard
Install front-facing node dependencies and activate the dev server proxying to port 8000:
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Verification & Running Tests

Validate logging context variables and API routes using the pytest execution framework:

```bash
# Run backend logging tests using the virtual environment
PYTHONPATH=./backend .venv/bin/pytest backend/app/tests/test_logging.py
```

Check system status with the API health check endpoint:
```bash
curl http://localhost:8000/api/health
```
