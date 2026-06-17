import fp from "fastify-plugin";
import fs from "node:fs";
import path from "node:path";
import { config } from "../../config.js";

export const audioRoutes = fp(async function audioRoutes(fastify) {
  fastify.get("/audio/*", async (req, reply) => {
    const filename = (req.params as { "*": string })["*"];

    if (filename.includes("..") || filename.startsWith("/") || filename.includes("\\")) {
      return reply.code(404).send({ error: "not found" });
    }

    const candidate = path.join(config.audioCacheDir, filename);
    if (!candidate.startsWith(config.audioCacheDir + path.sep)) {
      return reply.code(404).send({ error: "not found" });
    }
    if (fs.existsSync(candidate)) {
      const ext = path.extname(candidate).toLowerCase();
      const mime: Record<string, string> = {
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".opus": "audio/ogg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".oga": "audio/ogg",
      };
      reply.header("Content-Type", mime[ext] ?? "application/octet-stream");
      reply.header("Content-Length", fs.statSync(candidate).size);
      return reply.send(fs.createReadStream(candidate));
    }

    return reply.code(404).send({ error: "not found" });
  });
});
