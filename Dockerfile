# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Labels for DevOps tracking
LABEL maintainer="Nikhil Kumar B"
LABEL project="Smart Parking Management System"
LABEL version="2.0.0"

# Python runtime configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create application directories and dedicated non-root security user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -s /bin/bash -m appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

# Copy application source code
COPY --chown=appuser:appuser . .

# Switch to non-root user (DevSecOps Compliance)
USER appuser

EXPOSE 5000

# Docker native container health check
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')" || exit 1

CMD ["python", "app.py"]
