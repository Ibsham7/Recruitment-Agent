# ==============================================================================
# Production Dockerfile for Recruitment Agent Backend (FastAPI & ARQ Worker)
# ==============================================================================

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000

# Install system dependencies (OpenSSL & CA certificates for Prisma query engine and TLS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Step 1: Install Python dependencies (Leverage Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Step 2: Copy Prisma schema and generate Prisma Client Python
COPY prisma/ ./prisma/
RUN prisma generate --schema=prisma/schema.prisma

# Step 3: Copy application source code and entrypoint supervisor
COPY app/ ./app/
COPY entrypoint.sh ./entrypoint.sh

# Fix Windows CRLF line endings if present and grant execution permissions
RUN sed -i 's/\r$//' ./entrypoint.sh && chmod +x ./entrypoint.sh

# Step 4: Create a non-root system user for secure container execution
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser && \
    chown -R appuser:appgroup /app

USER appuser

# Expose FastAPI HTTP server port
EXPOSE 8000

# Health check probe against the FastAPI health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Launch both ARQ Worker and FastAPI Web API via process supervisor
CMD ["./entrypoint.sh"]
