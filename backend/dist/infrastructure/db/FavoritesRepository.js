import { prisma } from "./client.js";
export class FavoritesRepository {
    async isFavorite(trackId, profileId) {
        return !!(await prisma.favorite.findUnique({
            where: { trackId },
        }));
    }
    async toggle(trackId, profileId) {
        const existing = await prisma.favorite.findUnique({
            where: { trackId },
        });
        if (existing) {
            await prisma.favorite.delete({ where: { trackId } });
            return false;
        }
        await prisma.favorite.create({ data: { trackId, profileId } });
        return true;
    }
    async getAllFilenames() {
        const rows = await prisma.favorite.findMany({ select: { trackId: true } });
        return new Set(rows.map((r) => r.trackId));
    }
    async getFavoritesByProfile(profileId) {
        const rows = await prisma.favorite.findMany({
            where: { profileId },
            select: { trackId: true },
        });
        return new Set(rows.map((r) => r.trackId));
    }
    async deleteByTrackId(trackId) {
        await prisma.favorite.deleteMany({ where: { trackId } });
    }
}
//# sourceMappingURL=FavoritesRepository.js.map