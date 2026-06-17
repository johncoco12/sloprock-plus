import type { ILoopRepository } from "../../domain/repositories.js";
import type { Loop } from "../../domain/models/library.js";
export declare class LoopRepository implements ILoopRepository {
    findByTrackId(trackId: number, profileId: number): Promise<Loop[]>;
    create(trackId: number, profileId: number, name: string, startTime: number, endTime: number): Promise<Loop>;
    delete(id: number): Promise<void>;
    deleteAllByTrackId(trackId: number): Promise<void>;
}
//# sourceMappingURL=LoopRepository.d.ts.map