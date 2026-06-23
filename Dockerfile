FROM python:3.12-slim

WORKDIR /app

# Install system dependencies, postgresql, and redis
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    postgresql \
    postgresql-contrib \
    redis-server \
    && rm -rf /var/lib/apt/lists/*

# Add PostgreSQL binaries to PATH (debian version specific paths)
ENV PATH="/usr/lib/postgresql/15/bin:/usr/lib/postgresql/16/bin:${PATH}"

# Copy backend requirements first to leverage Docker cache
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source code (including worker, backend, agent, etc.)
COPY . .

# Set execution permission on start.sh
RUN chmod +x start.sh

# Expose backend port
EXPOSE 8000

# Start services using start.sh
CMD ["/bin/bash", "./start.sh"]
