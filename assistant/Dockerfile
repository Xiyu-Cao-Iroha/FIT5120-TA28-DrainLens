FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

COPY assistant/requirements.txt /app/assistant/requirements.txt

RUN pip install --no-cache-dir -r /app/assistant/requirements.txt

COPY assistant /app/assistant

EXPOSE 8080

CMD ["uvicorn", "assistant.api:app", "--host", "0.0.0.0", "--port", "8080"]