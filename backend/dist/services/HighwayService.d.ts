import type { ITrackRepository, ITrackDataRepository } from "../domain/repositories.js";
import type { Config } from "../config.js";
import type { HighwayResponse } from "../domain/models/highway.js";
import type { ProviderRegistry } from "../infrastructure/plugins/ProviderRegistry.js";
export type { HighwayResponse };
export declare class HighwayService {
    private readonly tracks;
    private readonly trackData;
    private readonly config;
    private readonly providers;
    constructor(tracks: ITrackRepository, trackData: ITrackDataRepository, config: Config, providers: ProviderRegistry);
    getHighwayData(trackId: string, arrangementIndex: number): Promise<HighwayResponse>;
}
//# sourceMappingURL=HighwayService.d.ts.map