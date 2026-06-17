import type { ITrackScoreRepository, TrackScore, TrackScoreWithName } from "../infrastructure/db/TrackScoreRepository.js";
export declare class TrackScoreService {
    private readonly repo;
    constructor(repo: ITrackScoreRepository);
    submit(profileId: number, trackId: string, score: number): Promise<TrackScore>;
    getBatch(profileId: number, trackIds: string[]): Promise<TrackScore[]>;
    getAll(): Promise<TrackScoreWithName[]>;
}
//# sourceMappingURL=TrackScoreService.d.ts.map