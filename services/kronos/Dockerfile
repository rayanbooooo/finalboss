# Kronos forecast sidecar.
#
# Vendors the upstream Kronos repo at build time rather than via pip, because
# it is not published to PyPI — `model/` is imported directly from a checkout.
FROM python:3.11-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin this to a reviewed commit before deploying. A moving target for a
# dependency that produces trading signals is not a dependency, it is a risk.
ARG KRONOS_REF=main
RUN git clone --depth 1 --branch ${KRONOS_REF} https://github.com/shiyu-coder/Kronos.git /app/kronos

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY main.py /app/main.py

# `from model import ...` resolves against the upstream checkout.
ENV PYTHONPATH=/app/kronos
# Weights land here; mount a volume to avoid re-downloading on each start.
ENV HF_HOME=/app/.cache/huggingface

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
