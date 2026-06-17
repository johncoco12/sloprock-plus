export interface TrackScore {
    id: number;
    profileId: number;
    trackId: string;
    bestScore: number;
    playCount: number;
    lastPlayedAt: Date;
}
export interface TrackScoreWithName extends TrackScore {
    playerName: string;
    title: string;
    artist: string;
}
export interface ITrackScoreRepository {
    upsertBetter(profileId: number, trackId: string, score: number): Promise<TrackScore>;
    findMany(profileId: number, trackIds: string[]): Promise<TrackScore[]>;
    findAll(): Promise<TrackScoreWithName[]>;
}
export declare class TrackScoreRepository implements ITrackScoreRepository {
    upsertBetter(profileId: number, trackId: string, score: number): Promise<TrackScore>;
    findMany(profileId: number, trackIds: string[]): Promise<TrackScore[]>;
    findAll(): Promise<TrackScoreWithName[]>;
}
//# sourceMappingURL=TrackScoreRepository.d.ts.map