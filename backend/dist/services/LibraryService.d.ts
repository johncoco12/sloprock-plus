import type { ISongRepository, IFavoritesRepository } from "../domain/repositories.js";
import type { ArtistGroup, LibraryQuery, LibraryStats, PageResult, SongMeta, TuningCount } from "../domain/models/library.js";
export declare class LibraryService {
    private readonly songs;
    private readonly favorites;
    constructor(songs: ISongRepository, favorites: IFavoritesRepository);
    search(query: LibraryQuery): Promise<PageResult<SongMeta>>;
    artists(opts: {
        q?: string;
        letter?: string;
        page: number;
        size: number;
        favoritesOnly: boolean;
    }): Promise<PageResult<ArtistGroup>>;
    stats(): Promise<LibraryStats>;
    tuningNames(): Promise<TuningCount[]>;
    toggleFavorite(trackId: string, profileId: number): Promise<boolean>;
    deleteOrphanedSongs(): Promise<number>;
}
//# sourceMappingURL=LibraryService.d.ts.map