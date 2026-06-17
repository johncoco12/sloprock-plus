import type { ILoopRepository } from "../domain/repositories.js";
import type { Loop } from "../domain/models/library.js";
export declare class LoopService {
    private readonly loops;
    constructor(loops: ILoopRepository);
    getLoops(trackId: number, profileId: number): Promise<Loop[]>;
    createLoop(trackId: number, profileId: number, name: string | undefined, startTime: number, endTime: number): Promise<Loop>;
    deleteLoop(id: number): Promise<void>;
}
//# sourceMappingURL=LoopService.d.ts.map