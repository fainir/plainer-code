FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy everything first
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -e .

# Expose port
EXPOSE ${PORT:-8000}

# Start command with migrations, using Railway's PORT variable
CMD ["sh", "-c", "alembic upgrade head && echo 'Starting uvicorn on port ${PORT:-8000}' && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
