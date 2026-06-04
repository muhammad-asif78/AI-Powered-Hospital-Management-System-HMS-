FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Use the same requirements as backend + celery
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker/ /app/worker/
COPY backend/app/ /app/app/

CMD ["celery", "-A", "worker.celery_app:celery_app", "worker", "--loglevel=info", "--concurrency=2"]
