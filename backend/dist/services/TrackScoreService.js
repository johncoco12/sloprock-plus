export class TrackScoreService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    submit(profileId, trackId, score) {
        return this.repo.upsertBetter(profileId, trackId, score);
    }
    getBatch(profileId, trackIds) {
        return this.repo.findMany(profileId, trackIds);
    }
    getAll() {
        return this.repo.findAll();
    }
}
//# sourceMappingURL=TrackScoreService.js.map