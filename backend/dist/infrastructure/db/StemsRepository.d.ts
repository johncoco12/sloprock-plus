import type { IStemsRepository } from "../../domain/repositories.js";
import type { TrackStems as TrackStemsModel } from "../../domain/models/track.js";
export declare class StemsRepository implements IStemsRepository {
    findByTrackId(trackId: number): Promise<TrackStemsModel | null>;
    create(trackId: number): Promise<TrackStemsModel>;
    delete(id: number): Promise<void>;
}
//# sourceMappingURL=StemsRepository.d.ts.map