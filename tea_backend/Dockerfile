FROM python:3.12-slim

# Set Python environment variables for containerized applications
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install uv
RUN pip install uv

COPY . /app
WORKDIR /app

# Install dependencies with uv from pyproject.toml
RUN uv pip install --system .

# Make entrypoint script executable
RUN chmod +x /app/docker-entrypoint.sh

# Setup for production
ENTRYPOINT ["/app/docker-entrypoint.sh"]
