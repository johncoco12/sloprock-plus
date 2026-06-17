# Build context: repo root (set context: . in compose, dockerfile: backend/Dockerfile)

# ── Stage 1: Build vgmstream-cli ─────────────────────────────────────────
FROM debian:bookworm-slim AS vgmstream-builder
ARG VGMSTREAM_REF=r2083

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config yasm git ca-certificates \
    libmpg123-dev libvorbis-dev libspeex-dev libopus-dev \
    libavformat-dev libavcodec-dev libavutil-dev libswresample-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${VGMSTREAM_REF}" https://github.com/vgmstream/vgmstream.git /tmp/vgmstream

RUN cmake -S /tmp/vgmstream -B /tmp/vgmstream/build \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_V123=OFF \
        -DBUILD_AUDACIOUS=OFF \
        -DBUILD_SHARED_LIBS=OFF \
    && cmake --build /tmp/vgmstream/build --target vgmstream_cli -j"$(nproc)" \
    && cp /tmp/vgmstream/build/cli/vgmstream-cli /usr/local/bin/vgmstream-cli

# ── Stage 3: Build pitch_yin WASM ────────────────────────────────────────
FROM emscripten/emsdk:latest AS wasm-builder

# Mirror the directory layout build.sh expects so its relative OUT_DIR resolves correctly:
#   plugins/pitch_yin/wasm/ → ../../static/vendor/pitch_yin/ = plugins/static/vendor/pitch_yin/
WORKDIR /build/plugins/pitch_yin/wasm
COPY plugins/pitch_yin/wasm/ .

RUN bash build.sh

# ── Stage 4: Compile TypeScript ───────────────────────────────────────────
FROM node:20-slim AS ts-builder
WORKDIR /build

COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma/ ./prisma/
RUN npm ci

COPY backend/src/ ./src/
COPY backend/tsconfig.json ./
RUN npx prisma generate && npm run build

# ── Stage 4b: Build format plugins ───────────────────────────────────────
FROM node:20-slim AS plugin-builder
WORKDIR /repo

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

COPY backend/scripts/ ./backend/scripts/
COPY backend/src/ ./backend/src/
COPY plugins/ ./plugins/
RUN node backend/scripts/build-plugins.mjs

# ── Stage 5: Final image ──────────────────────────────────────────────────
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fluidsynth \
    fluid-soundfont-gm \
    libsndfile1 \
    curl \
    megatools \
    netcat-openbsd \
    libmpg123-0 \
    libvorbisfile3 \
    libspeex1 \
    libopus0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=vgmstream-builder /usr/local/bin/vgmstream-cli /usr/local/bin/vgmstream-cli

WORKDIR /app

# Install runtime deps (includes prisma CLI for db push at startup)
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma/ ./prisma/
RUN npm ci --omit=dev && npm install --no-save prisma && npx prisma generate

COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Compiled backend: tsconfig outDir=dist, so src/index.ts → dist/index.js
COPY --from=ts-builder /build/dist ./dist/

# Assets served by the backend (WASM output overlays the plugin directory)
COPY --from=plugin-builder /repo/plugins/ ./plugins/
COPY --from=wasm-builder /build/plugins/static/vendor/pitch_yin/ ./plugins/static/vendor/pitch_yin/
COPY VERSION ./

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV VGMSTREAM_CLI=/usr/local/bin/vgmstream-cli
ENV LOG_PRETTY=true

EXPOSE 8080
# SlopAudio Connect UDP ports
EXPOSE 54920/udp
EXPOSE 54921/udp
EXPOSE 54922/udp

# db push creates/updates the schema on every start (idempotent, works with PostgreSQL)
CMD ["./docker-entrypoint.sh"]
