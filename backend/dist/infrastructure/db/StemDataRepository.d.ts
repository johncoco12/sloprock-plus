import type { IStemDataRepository } from "../../domain/repositories.js";
import type { StemData } from "../../domain/models/track.js";
export declare class StemDataRepository implements IStemDataRepository {
    findByStemsId(stemsId: number): Promise<StemData[]>;
    create(stemsId: number, stemIndex: number, arrangement?: string, stemAudioFileStorageId?: string): Promise<StemData>;
    update(id: number, data: Partial<Pick<StemData, "stemIndex" | "arrangement" | "stemAudioFileStorageId">>): Promise<StemData>;
    delete(id: number): Promise<void>;
}
//# sourceMappingURL=StemDataRepository.d.ts.map