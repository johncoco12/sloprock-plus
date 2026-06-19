/**
 * Backend route: POST /api/plugins/format_gp/import
 *
 * Accepts multipart/form-data with:
 *   file      (required)  — the .gp / .gpx file
 *   title     (optional)  — display-name override
 *   artist    (optional)  — artist name override
 *   album     (optional)  — album name override
 *   audio     (optional)  — audio file (OGG / MP3 / WAV …)
 *   coverArt  (optional)  — image file (JPG / PNG …)
 *
 * Saves the .gp file to DLC_DIR, writes a <filename>.gpimport.json sidecar with
 * the extra metadata, then enqueues a standard import job.
 */

import fs from "node:fs";
import path from "node:path";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { PluginContext } from "../../../backend/src/domain/interfaces/plugins/PluginContext.js";

// ─── Sidecar helpers (also imported by the provider) ─────────────────────────

export interface GpSidecar {
  title?: string;
  artist?: string;
  album?: string;
  audioPath?: string;
  coverArtPath?: string;
}

export function sidecarPath(gpFilePath: string): string {
  return gpFilePath + ".gpimport.json";
}

export function readSidecar(gpFilePath: string): GpSidecar | null {
  const sc = sidecarPath(gpFilePath);
  try {
    if (fs.existsSync(sc)) return JSON.parse(fs.readFileSync(sc, "utf8")) as GpSidecar;
  } catch {
    // corrupt sidecar — treat as absent
  }
  return null;
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerImportRoute(ctx: PluginContext): void {
  ctx.routes.register(
    "POST",
    "import",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const session = (req as unknown as { session: { profileId: number } | null }).session;
      if (!session) return reply.code(401).send({ error: "Not authenticated" });

      const dlcDir = process.env.DLC_DIR;
      if (!dlcDir) return reply.code(500).send({ error: "DLC_DIR not configured" });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importService = (req.server as any).imports;
      if (!importService) return reply.code(500).send({ error: "Import service unavailable" });

      // ── Parse multipart ───────────────────────────────────────────────────
      let gpFilename: string | null = null;
      let gpBuffer: Buffer | null = null;
      let audioFilename: string | null = null;
      let audioBuffer: Buffer | null = null;
      let coverBuffer: Buffer | null = null;
      let coverExt = ".jpg";
      let titleOverride: string | undefined;
      let artistOverride: string | undefined;
      let albumOverride: string | undefined;

      try {
        // req.parts() from @fastify/multipart — yields MultipartFile | MultipartValue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts = (req as any).parts({
          limits: { fileSize: 512 * 1024 * 1024 },
        }) as AsyncIterableIterator<{
          type: "file" | "field";
          fieldname: string;
          filename?: string;
          value?: string;
          toBuffer(): Promise<Buffer>;
        }>;

        for await (const part of parts) {
          if (part.type === "file") {
            const buf = await part.toBuffer();
            if (part.fieldname === "file") {
              gpFilename = part.filename ?? null;
              gpBuffer = buf;
            } else if (part.fieldname === "audio") {
              audioFilename = part.filename ?? null;
              audioBuffer = buf;
            } else if (part.fieldname === "coverArt") {
              coverBuffer = buf;
              coverExt = path.extname(part.filename ?? ".jpg") || ".jpg";
            }
          } else {
            const value = part.value ?? "";
            if (part.fieldname === "title" && value) titleOverride = value;
            else if (part.fieldname === "artist" && value) artistOverride = value;
            else if (part.fieldname === "album" && value) albumOverride = value;
          }
        }
      } catch {
        return reply.code(400).send({ error: "Failed to parse multipart data" });
      }

      if (!gpFilename || !gpBuffer) {
        return reply.code(400).send({ error: "No .gp file provided" });
      }

      // ── Path validation ───────────────────────────────────────────────────
      const gpDest = path.join(dlcDir, gpFilename);
      if (!path.resolve(gpDest).startsWith(path.resolve(dlcDir) + path.sep)) {
        return reply.code(400).send({ error: "Invalid filename" });
      }

      // ── Save GP file ──────────────────────────────────────────────────────
      await fs.promises.mkdir(dlcDir, { recursive: true });
      await fs.promises.writeFile(gpDest, gpBuffer);

      // ── Build sidecar ─────────────────────────────────────────────────────
      const sidecar: GpSidecar = {};
      if (titleOverride) sidecar.title = titleOverride;
      if (artistOverride) sidecar.artist = artistOverride;
      if (albumOverride) sidecar.album = albumOverride;

      if (audioBuffer && audioFilename) {
        const audioExt = path.extname(audioFilename) || ".ogg";
        const audioPath = gpDest + audioExt + ".gpimport_audio";
        await fs.promises.writeFile(audioPath, audioBuffer);
        sidecar.audioPath = audioPath;
      }

      if (coverBuffer) {
        const coverPath = gpDest + coverExt + ".gpimport_cover";
        await fs.promises.writeFile(coverPath, coverBuffer);
        sidecar.coverArtPath = coverPath;
      }

      await fs.promises.writeFile(
        sidecarPath(gpDest),
        JSON.stringify(sidecar, null, 2),
      );

      // ── Enqueue import ────────────────────────────────────────────────────
      const job = importService.enqueue(gpFilename, session.profileId);
      if (!job) {
        return reply.code(400).send({ error: "No format provider could handle this file" });
      }

      return reply.code(202).send({
        jobs: [{ jobId: job.id, status: job.status, filename: job.filename, format: job.format }],
      });
    },
    { requirePermission: "upload" },
  );
}
