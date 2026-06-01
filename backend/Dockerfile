# ==============================================================
# Ragleaf Backend - Production Dockerfile
# Python 3.11 + FastAPI + Tesseract OCR + ML Dependencies
# ==============================================================

# Build stage for dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    libmagic-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies (Docker-specific)
COPY backend/requirements-docker.txt ./requirements.txt
RUN pip install --no-cache-dir --user --timeout=300 -r requirements.txt

# ==============================================================
# Production stage
# ==============================================================
FROM python:3.11-slim AS production

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # For health checks
    curl \
    # OCR dependencies
    tesseract-ocr \
    tesseract-ocr-tur \
    tesseract-ocr-eng \
    # PDF processing
    poppler-utils \
    libpoppler-cpp-dev \
    # For python-magic
    libmagic1 \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder stage
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY backend ./backend
COPY .env* ./

# Create necessary directories with proper permissions
RUN mkdir -p uploads documents logs chroma_db \
    && chmod 755 uploads documents logs chroma_db

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/root/.cache/huggingface
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface/transformers

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
