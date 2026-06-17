import { NotFoundError } from "../../domain/errors.js";
import { prisma } from "./client.js";
function rowToStems(row) {
    return {
        id: row.id,
        trackId: row.trackId,
        stems: [],
    };
}
export class StemsRepository {
    async findByTrackId(trackId) {
        const row = await prisma.stems.findUnique({ where: { trackId } });
        return row ? rowToStems(row) : null;
    }
    async create(trackId) {
        const row = await prisma.stems.create({
            data: { trackId },
        });
        return rowToStems(row);
    }
    async delete(id) {
        try {
            await prisma.stems.delete({ where: { id } });
        }
        catch {
            throw new NotFoundError("Stems");
        }
    }
}
//# sourceMappingURL=StemsRepository.js.map