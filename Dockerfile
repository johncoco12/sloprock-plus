# ── Stage 1: Build native vgmstream-cli for target arch ──────────────────
FROM python:3.12-slim AS vgmstream-builder
ARG VGMSTREAM_REF=r2083

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    pkg-config \
    yasm \
    libmpg123-dev \
    libvorbis-dev \
    libspeex-dev \
    libavformat-dev \
    libavcodec-dev \
    libavutil-dev \
    libswresample-dev \
    libopus-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${VGMSTREAM_REF}" https://github.com/vgmstream/vgmstream.git /tmp/vgmstream

RUN cmake -S /tmp/vgmstream -B /tmp/vgmstream/build \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_V123=OFF \
        -DBUILD_AUDACIOUS=OFF \
        -DBUILD_SHARED_LIBS=OFF \
    && cmake --build /tmp/vgmstream/build --config Release --target vgmstream_cli -j"$(nproc)" \
    && mkdir -p /out \
    && cp /tmp/vgmstream/build/cli/vgmstream-cli /out/vgmstream-cli

# ── Stage 2: Final image ────────────────────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fluidsynth \
    fluid-soundfont-gm \
    libsndfile1 \
    curl \
    megatools \
    # Runtime shared libraries for the natively-built vgmstream-cli.
    # `BUILD_SHARED_LIBS=OFF` in the builder stage only static-links
    # vgmstream's own libs; the external codec dependencies it linked
    # against (mpg123, vorbis, speex, opus) are still dynamic and need
    # their runtime packages here. ffmpeg pulls in libav* + libswresample
    # transitively, but mpg123 / vorbis / speex / opus aren't guaranteed.
    libmpg123-0 \
    libvorbisfile3 \
    libspeex1 \
    libopus0 \
    && rm -rf /var/lib/apt/lists/*

# Native vgmstream-cli built against the image's own libraries
COPY --from=vgmstream-builder /out/vgmstream-cli /usr/local/bin/vgmstream-cli
RUN chmod +x /usr/local/bin/vgmstream-cli

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY lib/ /app/lib/
COPY static/ /app/static/
COPY plugins/ /app/plugins/
COPY server.py /app/
COPY main.py /app/
COPY VERSION /app/

ENV PYTHONPATH=/app/lib:/app

EXPOSE 8000

# main.py calls configure_logging() before uvicorn.run(..., log_config=None),
# which prevents uvicorn from applying its default dictConfig.  This ensures
# the structlog pipeline is active for ALL uvicorn messages — including the
# early lifecycle lines ("Started server process", "Waiting for application
# startup") that fire before the ASGI startup hook.
CMD python main.py
