FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends g++ && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --uid 10001 --create-home runner && \
    mkdir -p /workspace /tmp/compiler && \
    chown -R runner:runner /workspace /tmp/compiler

WORKDIR /workspace

USER 10001:10001