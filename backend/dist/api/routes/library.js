import fp from "fastify-plugin";
import { z } from "zod";
import { requireAuthAsync } from "../middleware/auth.js";
const LibraryQuerySchema = z.object({
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(200).default(50),
    sort: z
        .enum(["artist", "artist-desc", "title", "title-desc", "recent", "tuning", "year", "year-desc"])
        .default("artist"),
    favorites: z.coerce.number().int().transform(Boolean).default(0),
    format: z.string().optional(),
    arrangements_has: z.string().optional(),
    arrangements_lacks: z.string().optional(),
    stems_has: z.string().optional(),
    stems_lacks: z.string().optional(),
    has_lyrics: z.enum(["0", "1"]).optional(),
    tunings: z.string().optional(),
});
function csvList(value) {
    return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}
export const libraryRoutes = fp(async function libraryRoutes(fastify) {
    const library = fastify.library;
    fastify.get("/api/library", { preHandler: [requireAuthAsync()] }, async (req) => {
        const q = LibraryQuerySchema.parse(req.query);
        const query = {
            q: q.q,
            page: q.page || 1,
            size: q.size,
            sort: q.sort,
            favoritesOnly: q.favorites,
            format: q.format,
            arrangementsHas: csvList(q.arrangements_has),
            arrangementsLacks: csvList(q.arrangements_lacks),
            stemsHas: csvList(q.stems_has),
            stemsLacks: csvList(q.stems_lacks),
            hasLyrics: q.has_lyrics === "1" ? true : q.has_lyrics === "0" ? false : undefined,
            tunings: csvList(q.tunings),
        };
        req.log.info({ query }, "library search request");
        const result = await library.search(query);
        req.log.info({ total: result.total }, "library search complete");
        return { songs: result.items, total: result.total, page: result.page, size: result.size };
    });
    fastify.get("/api/library/artists", { preHandler: [requireAuthAsync()] }, async (req) => {
        const q = z.object({
            q: z.string().optional(),
            letter: z.string().max(2).optional(),
            page: z.coerce.number().int().min(1).default(1),
            size: z.coerce.number().int().min(1).max(50).default(20),
            favorites: z.coerce.number().int().transform(Boolean).default(0),
        }).parse(req.query);
        const result = await library.artists({
            q: q.q,
            letter: q.letter,
            page: q.page,
            size: q.size,
            favoritesOnly: q.favorites,
        });
        return { artists: result.items, total: result.total, page: result.page, size: result.size };
    });
    fastify.get("/api/library/stats", { preHandler: [requireAuthAsync()] }, async (req) => {
        return library.stats();
    });
    fastify.get("/api/library/tuning-names", { preHandler: [requireAuthAsync()] }, async (req) => {
        return library.tuningNames();
    });
    fastify.post("/api/library/cleanup-orphans", { preHandler: [requireAuthAsync()] }, async (_req, reply) => {
        const deleted = await library.deleteOrphanedSongs();
        return reply.send({ deleted });
    });
    fastify.get("/api/startup-status", async () => {
        return { stage: "ready", plugins_loaded: true };
    });
});
//# sourceMappingURL=library.js.map