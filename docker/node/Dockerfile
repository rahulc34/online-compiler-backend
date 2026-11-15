FROM node:22-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends tar && \
    rm -rf /var/lib/apt/lists/*

RUN npm install --global --no-audit --no-fund typescript@7.0.2 @types/node@22 && \
    useradd --uid 10001 --create-home runner && \
    mkdir -p /workspace /tmp/compiler && \
    chown -R runner:runner /workspace /tmp/compiler

WORKDIR /workspace

USER 10001:10001
