#!/bin/sh
set -e

# ==============================================================================
# Single-Container Process Supervisor for FastAPI Web API & ARQ Worker
# ==============================================================================

WORKER_PID=""
UVICORN_PID=""

# Graceful termination signal handler
shutdown() {
    echo "[Entrypoint] Received shutdown signal. Gracefully stopping services..."
    if [ -n "$WORKER_PID" ]; then
        kill -TERM "$WORKER_PID" 2>/dev/null || true
    fi
    if [ -n "$UVICORN_PID" ]; then
        kill -TERM "$UVICORN_PID" 2>/dev/null || true
    fi
    wait "$WORKER_PID" 2>/dev/null || true
    wait "$UVICORN_PID" 2>/dev/null || true
    echo "[Entrypoint] All background services stopped cleanly. Exiting."
    exit 0
}

# Trap termination signals sent by Docker / Render (POSIX sh / dash compliant)
trap shutdown TERM INT QUIT

# When ENABLE_EMBEDDED_WORKER is not explicitly "false", the ARQ worker runs directly inside
# FastAPI's async lifespan, ensuring zero extra process overhead, shared DB pools, and 100%
# immunity to Render Start Command overrides.
if [ "${ENABLE_EMBEDDED_WORKER:-true}" = "false" ]; then
    echo "[Entrypoint] Starting Standalone ARQ Background Worker..."
    python -u -m app.run_worker &
    WORKER_PID=$!
    echo "[Entrypoint] Standalone ARQ Worker running with PID $WORKER_PID."
fi

echo "[Entrypoint] Starting FastAPI Web Server on port ${PORT:-8000}..."
if [ -n "$WORKER_PID" ]; then
    uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" &
    UVICORN_PID=$!
    wait "$UVICORN_PID"
else
    exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
fi
