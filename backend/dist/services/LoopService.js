export class LoopService {
    loops;
    constructor(loops) {
        this.loops = loops;
    }
    async getLoops(trackId, profileId) {
        return this.loops.findByTrackId(trackId, profileId);
    }
    async createLoop(trackId, profileId, name, startTime, endTime) {
        let resolvedName = name;
        if (!resolvedName) {
            const existing = await this.loops.findByTrackId(trackId, profileId);
            resolvedName = `Loop ${existing.length + 1}`;
        }
        return this.loops.create(trackId, profileId, resolvedName, startTime, endTime);
    }
    async deleteLoop(id) {
        await this.loops.delete(id);
    }
}
//# sourceMappingURL=LoopService.js.map