import type { ISongRepository, SongInput } from "../../domain/repositories.js";
import type { ArtistGroup, LibraryQuery, LibraryStats, PageResult, SongMeta, TuningCount } from "../../domain/models/library.js";
export declare class SongRepository implements ISongRepository {
    private getFavorites;
    private getTrackIdMap;
    private getValidFilenames;
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
    findByFilename(filename: string): Promise<SongMeta | null>;
    findCached(filename: string, mtime: number, size: number): Promise<SongMeta | null>;
    upsert(filename: string, input: SongInput): Promise<void>;
    delete(filename: string): Promise<void>;
    deleteStale(keepFilenames: Set<string>): Promise<number>;
    deleteOrphaned(): Promise<number>;
}
//# sourceMappingURL=SongRepository.d.ts.map