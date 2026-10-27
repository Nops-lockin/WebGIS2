# Multi-stage build for the WebGIS project
# ---- Frontend build stage ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ---- Backend stage ----
FROM python:3.12-slim AS backend
WORKDIR /app

# Create virtual environment and install Python deps
COPY backend/requirements.txt ./
RUN python -m venv .venv && \
    . .venv/bin/activate && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./

# Copy built frontend assets into backend static directory
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Expose port for FastAPI
EXPOSE 8000

# Set PATH to include venv binaries
ENV PATH="/app/.venv/bin:${PATH}"

# Default command to run the API
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

