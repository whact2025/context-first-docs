# Multi-stage: build then minimal runtime image.
# Build stage uses Rust on Alpine for a static (musl) binary.
# Final stage uses the same lightweight Alpine base.

# ---- Builder ----
FROM rust:1-alpine AS builder

RUN apk add --no-cache musl-dev

WORKDIR /build

COPY Cargo.toml Cargo.lock* ./
COPY src ./src

# Build release binary (statically linked for Alpine).
RUN cargo build --release

# ---- Runtime ----
FROM alpine:3.19

RUN apk add --no-cache wget \
  && adduser -D -g "" app

COPY --from=builder /build/target/release/truthlayer-server /usr/local/bin/truthlayer-server

USER app

EXPOSE 3080

ENV TRUTHTLAYER_LISTEN=0.0.0.0:3080

ENTRYPOINT ["/usr/local/bin/truthlayer-server"]
