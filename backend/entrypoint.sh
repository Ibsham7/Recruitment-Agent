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

# Trap termination signals sent by Docker / Render
trap shutdown SIGTERM SIGINT SIGQUIT

echo "[Entrypoint] Starting ARQ Background Worker..."
arq app.worker.WorkerSettings &
WORKER_PID=$!

echo "[Entrypoint] Starting FastAPI Web Server on port ${PORT:-8000}..."
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" &
UVICORN_PID=$!

echo "[Entrypoint] Both FastAPI and ARQ Worker are running (PIDs: Worker=$WORKER_PID, Web=$UVICORN_PID)."

# Wait for Uvicorn process in the foreground
wait "$UVICORN_PID"
