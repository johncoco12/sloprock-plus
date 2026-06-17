import type { ITrackRepository, ITrackDataRepository, IStemsRepository, IStemDataRepository, ILoopRepository, IFavoritesRepository, ISongRepository } from "../domain/repositories.js";
import type { Track, TrackData, StemData, UpdateTrackInput } from "../domain/models/track.js";
import type { Loop } from "../domain/models/library.js";
import type { IStorageService } from "../domain/interfaces/services/IStorageService.js";
export declare class TrackService {
    private readonly tracks;
    private readonly trackData;
    private readonly stems;
    private readonly stemData;
    private readonly loops;
    private readonly storage;
    private readonly favorites;
    private readonly songs;
    constructor(tracks: ITrackRepository, trackData: ITrackDataRepository, stems: IStemsRepository, stemData: IStemDataRepository, loops: ILoopRepository, storage: IStorageService, favorites: IFavoritesRepository, songs: ISongRepository);
    getTrack(trackId: string): Promise<Track>;
    getTrackData(trackId: string): Promise<TrackData>;
    getStems(trackId: string): Promise<StemData[]>;
    getCoverArt(trackId: string): Promise<{
        data: Buffer;
        mimeType: string;
    } | null>;
    getAudio(trackId: string): Promise<{
        data: Buffer;
        mimeType: string;
    } | null>;
    getStemAudio(trackId: string, stemIndex: number): Promise<{
        data: Buffer;
        mimeType: string;
    } | null>;
    getLoops(trackId: string, profileId: number): Promise<Loop[]>;
    addLoop(trackId: string, profileId: number, name: string | undefined, startTime: number, endTime: number): Promise<Loop>;
    deleteLoop(loopId: number): Promise<void>;
    getCovers(count: number): Promise<string[]>;
    updateTrack(trackId: string, input: UpdateTrackInput): Promise<Track>;
    deleteTrack(trackId: string): Promise<void>;
}
//# sourceMappingURL=TrackService.d.ts.map