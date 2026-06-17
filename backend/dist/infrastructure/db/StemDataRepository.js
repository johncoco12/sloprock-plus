import { NotFoundError } from "../../domain/errors.js";
import { prisma } from "./client.js";
function rowToStemData(row) {
    return {
        id: row.id,
        trackId: row.stemsId,
        stemIndex: row.stemIndex,
        arrangement: row.arrangement,
        stemAudioFileStorageId: row.stemAudioFileStorageId,
    };
}
export class StemDataRepository {
    async findByStemsId(stemsId) {
        const rows = await prisma.stemData.findMany({ where: { stemsId } });
        return rows.map(rowToStemData);
    }
    async create(stemsId, stemIndex, arrangement, stemAudioFileStorageId) {
        const row = await prisma.stemData.create({
            data: {
                stemsId,
                stemIndex,
                arrangement: arrangement ?? null,
                stemAudioFileStorageId: stemAudioFileStorageId ?? null,
            },
        });
        return rowToStemData(row);
    }
    async update(id, data) {
        const updateData = {};
        if (data.stemIndex !== undefined)
            updateData.stemIndex = data.stemIndex;
        if (data.arrangement !== undefined)
            updateData.arrangement = data.arrangement;
        if (data.stemAudioFileStorageId !== undefined)
            updateData.stemAudioFileStorageId = data.stemAudioFileStorageId;
        const row = await prisma.stemData.update({ where: { id }, data: updateData });
        return rowToStemData(row);
    }
    async delete(id) {
        try {
            await prisma.stemData.delete({ where: { id } });
        }
        catch {
            throw new NotFoundError("StemData");
        }
    }
}
//# sourceMappingURL=StemDataRepository.js.map