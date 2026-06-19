import { createRequire } from "module"; const require = createRequire(import.meta.url);

// plugins/format_gp/src/GuitarProImportRoute.ts
import fs from "node:fs";
import path from "node:path";
function sidecarPath(gpFilePath) {
  return gpFilePath + ".gpimport.json";
}
function readSidecar(gpFilePath) {
  const sc = sidecarPath(gpFilePath);
  try {
    if (fs.existsSync(sc)) return JSON.parse(fs.readFileSync(sc, "utf8"));
  } catch {
  }
  return null;
}
function registerImportRoute(ctx) {
  ctx.routes.register(
    "POST",
    "import",
    async (req, reply) => {
      const session = req.session;
      if (!session) return reply.code(401).send({ error: "Not authenticated" });
      const dlcDir = process.env.DLC_DIR;
      if (!dlcDir) return reply.code(500).send({ error: "DLC_DIR not configured" });
      const importService = req.server.imports;
      if (!importService) return reply.code(500).send({ error: "Import service unavailable" });
      let gpFilename = null;
      let gpBuffer = null;
      let audioFilename = null;
      let audioBuffer = null;
      let coverBuffer = null;
      let coverExt = ".jpg";
      let titleOverride;
      let artistOverride;
      let albumOverride;
      try {
        const parts = req.parts({
          limits: { fileSize: 512 * 1024 * 1024 }
        });
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
      const gpDest = path.join(dlcDir, gpFilename);
      if (!path.resolve(gpDest).startsWith(path.resolve(dlcDir) + path.sep)) {
        return reply.code(400).send({ error: "Invalid filename" });
      }
      await fs.promises.mkdir(dlcDir, { recursive: true });
      await fs.promises.writeFile(gpDest, gpBuffer);
      const sidecar = {};
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
        JSON.stringify(sidecar, null, 2)
      );
      const job = importService.enqueue(gpFilename, session.profileId);
      if (!job) {
        return reply.code(400).send({ error: "No format provider could handle this file" });
      }
      return reply.code(202).send({
        jobs: [{ jobId: job.id, status: job.status, filename: job.filename, format: job.format }]
      });
    },
    { requirePermission: "upload" }
  );
}
export {
  readSidecar,
  registerImportRoute,
  sidecarPath
};
//# sourceMappingURL=GuitarProImportRoute.js.map
