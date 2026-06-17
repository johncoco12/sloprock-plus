import type { ITrackRepository } from "../../domain/repositories.js";
import type { Track, CreateTrackInput, UpdateTrackInput } from "../../domain/models/track.js";
export declare class TrackRepository implements ITrackRepository {
    findById(id: number): Promise<Track | null>;
    findByTrackId(trackId: string): Promise<Track | null>;
    findAll(): Promise<Track[]>;
    create(input: CreateTrackInput): Promise<Track>;
    update(id: number, input: UpdateTrackInput): Promise<Track>;
    delete(id: number): Promise<void>;
}
//# sourceMappingURL=TrackRepository.d.ts.map