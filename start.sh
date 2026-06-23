#!/bin/bash
set -e

# Overwrite environment variables to point to localhost inside this single container
export PATH="/usr/lib/postgresql/15/bin:/usr/lib/postgresql/16/bin:/usr/lib/postgresql/17/bin:${PATH}"
export DATABASE_URL="postgresql+asyncpg://linearhealth:linearhealth_secret@localhost:5432/hospital_management"
export REDIS_URL="redis://localhost:6379/0"
export CELERY_BROKER_URL="redis://localhost:6379/0"
export CELERY_RESULT_BACKEND="redis://localhost:6379/1"

export PYTHONPATH="/app/backend:/app:${PYTHONPATH}"

echo "=== Starting Redis ==="
redis-server --port 6379 --dir /tmp --daemonize yes

echo "=== Setting up PostgreSQL ==="
PG_DATA="/tmp/pgdata"
mkdir -p "$PG_DATA"
chown -R postgres:postgres "$PG_DATA"

if [ -z "$(ls -A "$PG_DATA")" ]; then
    echo "Initializing database cluster..."
    su -s /bin/bash postgres -c "export PATH=\"/usr/lib/postgresql/15/bin:/usr/lib/postgresql/16/bin:/usr/lib/postgresql/17/bin:\$PATH\"; initdb -D $PG_DATA"
fi

echo "Starting PostgreSQL..."
# Run postgres daemon as postgres user. Bind to localhost, port 5432, socket directory in /tmp
su -s /bin/bash postgres -c "export PATH=\"/usr/lib/postgresql/15/bin:/usr/lib/postgresql/16/bin:/usr/lib/postgresql/17/bin:\$PATH\"; postgres -D $PG_DATA -h localhost -p 5432 -k /tmp" > /tmp/postgres.log 2>&1 &

echo "Waiting for PostgreSQL to start..."
until pg_isready -h localhost -p 5432; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Configuring PostgreSQL roles and database..."
su -s /bin/bash postgres -c "export PATH=\"/usr/lib/postgresql/15/bin:/usr/lib/postgresql/16/bin:/usr/lib/postgresql/17/bin:\$PATH\"; psql -h localhost -p 5432 -d postgres -c \"CREATE ROLE linearhealth WITH LOGIN PASSWORD 'linearhealth_secret' SUPERUSER;\"" || true
su -s /bin/bash postgres -c "export PATH=\"/usr/lib/postgresql/15/bin:/usr/lib/postgresql/16/bin:/usr/lib/postgresql/17/bin:\$PATH\"; psql -h localhost -p 5432 -d postgres -c \"CREATE DATABASE hospital_management OWNER linearhealth;\"" || true

echo "=== Starting Celery Worker ==="
python -m celery -A worker.celery_app worker --loglevel=info > /tmp/celery.log 2>&1 &

echo "=== Starting FastAPI Application ==="
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
