# Embedding Service - PyTorch with GPU/CPU support
FROM python:3.11-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY services/embedding-service/requirements.txt .

# Install PyTorch (CPU version by default, GPU version via override)
ARG TORCH_VERSION=cpu
RUN if [ "$TORCH_VERSION" = "gpu" ]; then \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu118; \
    else \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu; \
    fi

# Install other requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY services/embedding-service ./

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/root/.cache/huggingface
ENV DEVICE=auto

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
