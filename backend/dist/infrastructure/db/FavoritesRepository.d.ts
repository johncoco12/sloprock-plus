import type { IFavoritesRepository } from "../../domain/repositories.js";
export declare class FavoritesRepository implements IFavoritesRepository {
    isFavorite(trackId: string, profileId: number): Promise<boolean>;
    toggle(trackId: string, profileId: number): Promise<boolean>;
    getAllFilenames(): Promise<Set<string>>;
    getFavoritesByProfile(profileId: number): Promise<Set<string>>;
    deleteByTrackId(trackId: string): Promise<void>;
}
//# sourceMappingURL=FavoritesRepository.d.ts.map