# python:3.11-slim
FROM python@sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce AS builder

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

COPY assistant/requirements.lock /build/requirements.lock

RUN pip install --no-cache-dir \
    --require-hashes \
    -r /build/requirements.lock

# python:3.11-slim
FROM python@sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 drainlens \
    && useradd \
        --uid 10001 \
        --gid 10001 \
        --no-create-home \
        --shell /usr/sbin/nologin \
        drainlens

COPY --from=builder /opt/venv /opt/venv

RUN rm -rf \
    /opt/venv/lib/python3.11/site-packages/pip \
    /opt/venv/lib/python3.11/site-packages/pip-* \
    /opt/venv/lib/python3.11/site-packages/setuptools \
    /opt/venv/lib/python3.11/site-packages/setuptools-* \
    /opt/venv/lib/python3.11/site-packages/wheel \
    /opt/venv/lib/python3.11/site-packages/wheel-* \
    /opt/venv/bin/pip \
    /opt/venv/bin/pip3 \
    /opt/venv/bin/pip3.11 \
    /usr/local/lib/python3.11/site-packages/pip \
    /usr/local/lib/python3.11/site-packages/pip-* \
    /usr/local/lib/python3.11/site-packages/setuptools \
    /usr/local/lib/python3.11/site-packages/setuptools-* \
    /usr/local/lib/python3.11/site-packages/wheel \
    /usr/local/lib/python3.11/site-packages/wheel-*

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp \
    DRAINLENS_CHROMA_PATH=/tmp/chroma_db \
    DRAINLENS_MODEL_PATH=/artifacts/model.gguf \
    DRAINLENS_CORPUS_RELEASE_PATH=/artifacts/corpus

COPY --chown=10001:10001 assistant /app/assistant

USER 10001:10001

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=5).read()" || exit 1

CMD ["python", "-m", "assistant.start_verified"]