FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for python-magic
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy everything first (respects .dockerignore)
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir .

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
