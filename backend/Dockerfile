FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for python-magic
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy everything first
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -e .

# Expose port
EXPOSE 8000

# Start command with debug listing
CMD ["sh", "-c", "echo '=== FILES IN /app ==='; find /app -type f | sort; echo '=== END FILES ==='; uvicorn app.main:app --host 0.0.0.0 --port 8000"]
