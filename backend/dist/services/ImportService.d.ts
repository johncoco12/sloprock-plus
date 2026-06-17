import type { ISongRepository, ITrackRepository, ITrackDataRepository, IStemsRepository, IStemDataRepository } from "../domain/repositories.js";
import type { ImportJob, ImportResult } from "../domain/models/import.js";
import type { IStorageService } from "../domain/interfaces/services/IStorageService.js";
import type { Config } from "../config.js";
import type { ProviderRegistry } from "../infrastructure/plugins/ProviderRegistry.js";
import type { HookSystem } from "../infrastructure/plugins/HookSystem.js";
export declare class ImportService {
    private readonly songs;
    private readonly tracks;
    private readonly trackData;
    private readonly stemsRepo;
    private readonly stemDataRepo;
    private readonly storage;
    private readonly config;
    private readonly providers;
    private readonly hooks;
    private queue;
    private results;
    private limiter;
    private running;
    constructor(songs: ISongRepository, tracks: ITrackRepository, trackData: ITrackDataRepository, stemsRepo: IStemsRepository, stemDataRepo: IStemDataRepository, storage: IStorageService, config: Config, providers: ProviderRegistry, hooks: HookSystem);
    enqueue(filename: string, profileId: number): ImportJob | null;
    getStatus(jobId: string): ImportJob | null;
    getAllJobs(): ImportJob[];
    getResult(jobId: string): ImportResult | null;
    private findProvider;
    private processJob;
    private buildSongInput;
}
//# sourceMappingURL=ImportService.d.ts.map