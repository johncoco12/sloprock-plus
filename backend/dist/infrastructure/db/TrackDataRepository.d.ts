import type { ITrackDataRepository } from "../../domain/repositories.js";
import type { TrackData } from "../../domain/models/track.js";
export declare class TrackDataRepository implements ITrackDataRepository {
    findByTrackId(trackId: number): Promise<TrackData | null>;
    findByOriginalFilename(originalFilename: string): Promise<TrackData | null>;
    findWithCovers(limit: number): Promise<string[]>;
    create(trackId: number, originalFilename: string, arrangements: unknown, coverImageStorageId?: string, audioFileStorageId?: string): Promise<TrackData>;
    update(id: number, data: Partial<Pick<TrackData, "arrangements" | "coverImageStorageId" | "audioFileStorageId">>): Promise<TrackData>;
    delete(id: number): Promise<void>;
}
//# sourceMappingURL=TrackDataRepository.d.ts.map