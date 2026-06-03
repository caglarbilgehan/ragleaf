# API Gateway - FastAPI
# Uses existing backend code with modifications for microservices

# Stage 1: Python dependencies builder
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies (use full backend requirements for now)
COPY backend/requirements-docker.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Widget builder (lightweight Node)
FROM node:20-alpine AS widget-builder
WORKDIR /widget
COPY widget/src ./src
COPY widget/package.json ./
RUN npm install -g esbuild && \
    mkdir -p dist && \
    esbuild src/index.ts --bundle --minify --format=iife --outfile=dist/widget.js --target=es2018

# Stage 3: Production
FROM python:3.11-slim AS production

WORKDIR /app

# Install runtime dependencies (including OCR/PDF tools still used by backend)
RUN apt-get update && apt-get install -y \
    curl \
    libmagic1 \
    tesseract-ocr \
    tesseract-ocr-tur \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY backend ./backend
COPY --from=widget-builder /widget/dist ./widget/dist
COPY .env* ./

# Create necessary directories
RUN mkdir -p uploads documents logs \
    && chmod 755 uploads documents logs

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Microservices endpoints
ENV OCR_SERVICE_URL=http://ocr-service:8001
ENV EMBEDDING_SERVICE_URL=http://embedding-service:8002

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
