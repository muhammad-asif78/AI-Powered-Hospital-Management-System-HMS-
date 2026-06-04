FROM python:3.12-slim

WORKDIR /app

# Install system deps needed by silero/onnxruntime and audio codecs
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libgl1 \
    libglib2.0-0 \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Use 'start' (production mode) — not 'dev' which uses watchfiles and restarts
CMD ["python", "agent.py", "start"]
