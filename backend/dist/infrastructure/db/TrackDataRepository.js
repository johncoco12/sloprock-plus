import { NotFoundError } from "../../domain/errors.js";
import { prisma } from "./client.js";
function rowToTrackData(row) {
    return {
        id: row.id,
        trackId: row.trackId,
        originalFilename: row.originalFilename,
        arrangements: row.arrangements,
        coverImageStorageId: row.coverImageStorageId,
        audioFileStorageId: row.audioFileStorageId,
    };
}
export class TrackDataRepository {
    async findByTrackId(trackId) {
        const row = await prisma.trackData.findUnique({ where: { trackId } });
        return row ? rowToTrackData(row) : null;
    }
    async findByOriginalFilename(originalFilename) {
        const row = await prisma.trackData.findUnique({ where: { originalFilename } });
        return row ? rowToTrackData(row) : null;
    }
    async findWithCovers(limit) {
        const rows = await prisma.trackData.findMany({
            where: { coverImageStorageId: { not: null } },
            select: { track: { select: { trackId: true } } },
        });
        const ids = rows.map((r) => r.track.trackId);
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        const sanitizedLimit = Math.max(0, Math.floor(limit));
        return ids.slice(0, sanitizedLimit);
    }
    async create(trackId, originalFilename, arrangements, coverImageStorageId, audioFileStorageId) {
        const row = await prisma.trackData.create({
            data: {
                trackId,
                originalFilename,
                arrangements: arrangements,
                coverImageStorageId: coverImageStorageId ?? null,
                audioFileStorageId: audioFileStorageId ?? null,
            },
        });
        return rowToTrackData(row);
    }
    async update(id, data) {
        const updateData = {};
        if (data.arrangements !== undefined)
            updateData.arrangements = data.arrangements;
        if (data.coverImageStorageId !== undefined)
            updateData.coverImageStorageId = data.coverImageStorageId;
        if (data.audioFileStorageId !== undefined)
            updateData.audioFileStorageId = data.audioFileStorageId;
        const row = await prisma.trackData.update({ where: { id }, data: updateData });
        return rowToTrackData(row);
    }
    async delete(id) {
        try {
            await prisma.trackData.delete({ where: { id } });
        }
        catch {
            throw new NotFoundError("TrackData");
        }
    }
}
//# sourceMappingURL=TrackDataRepository.js.map