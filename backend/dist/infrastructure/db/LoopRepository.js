import { NotFoundError } from "../../domain/errors.js";
import { prisma } from "./client.js";
export class LoopRepository {
    async findByTrackId(trackId, profileId) {
        const rows = await prisma.trackLoop.findMany({
            where: { trackId, profileId },
            orderBy: { createdAt: "asc" },
        });
        return rows.map((r) => ({
            id: r.id,
            profileId: r.profileId,
            trackId: r.trackId,
            name: r.name,
            startTime: r.startTime,
            endTime: r.endTime,
            createdAt: r.createdAt,
        }));
    }
    async create(trackId, profileId, name, startTime, endTime) {
        const row = await prisma.trackLoop.create({
            data: { trackId, profileId, name, startTime, endTime },
        });
        return {
            id: row.id,
            profileId: row.profileId,
            trackId: row.trackId,
            name: row.name,
            startTime: row.startTime,
            endTime: row.endTime,
            createdAt: row.createdAt,
        };
    }
    async delete(id) {
        try {
            await prisma.trackLoop.delete({ where: { id } });
        }
        catch {
            throw new NotFoundError(`Loop ${id}`);
        }
    }
    async deleteAllByTrackId(trackId) {
        await prisma.trackLoop.deleteMany({ where: { trackId } });
    }
}
//# sourceMappingURL=LoopRepository.js.map