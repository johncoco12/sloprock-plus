import { NotFoundError } from "../domain/errors.js";
export class TrackService {
    tracks;
    trackData;
    stems;
    stemData;
    loops;
    storage;
    favorites;
    songs;
    constructor(tracks, trackData, stems, stemData, loops, storage, favorites, songs) {
        this.tracks = tracks;
        this.trackData = trackData;
        this.stems = stems;
        this.stemData = stemData;
        this.loops = loops;
        this.storage = storage;
        this.favorites = favorites;
        this.songs = songs;
    }
    async getTrack(trackId) {
        const track = await this.tracks.findByTrackId(trackId);
        if (!track)
            throw new NotFoundError("Track");
        return track;
    }
    async getTrackData(trackId) {
        const track = await this.tracks.findByTrackId(trackId);
        if (!track)
            throw new NotFoundError("Track");
        const data = await this.trackData.findByTrackId(track.id);
        if (!data)
            throw new NotFoundError("TrackData");
        return data;
    }
    async getStems(trackId) {
        const track = await this.tracks.findByTrackId(trackId);
        if (!track)
            throw new NotFoundError("Track");
        const stemsRecord = await this.stems.findByTrackId(track.id);
        if (!stemsRecord)
            return [];
        return this.stemData.findByStemsId(stemsRecord.id);
    }
    async getCoverArt(trackId) {
        const data = await this.getTrackData(trackId);
        if (!data.coverImageStorageId)
            return null;
        const buffer = await this.storage.get(data.coverImageStorageId);
        if (!buffer)
            return null;
        return { data: buffer, mimeType: "image/png" };
    }
    async getAudio(trackId) {
        const data = await this.getTrackData(trackId);
        if (!data.audioFileStorageId)
            return null;
        const buffer = await this.storage.get(data.audioFileStorageId);
        if (!buffer)
            return null;
        return { data: buffer, mimeType: "audio/mpeg" };
    }
    async getStemAudio(trackId, stemIndex) {
        const allStems = await this.getStems(trackId);
        const stem = allStems.find((s) => s.stemIndex === stemIndex);
        if (!stem || !stem.stemAudioFileStorageId)
            return null;
        const buffer = await this.storage.get(stem.stemAudioFileStorageId);
        if (!buffer)
            return null;
        return { data: buffer, mimeType: "audio/ogg" };
    }
    async getLoops(trackId, profileId) {
        const track = await this.tracks.findByTrackId(trackId);
        if (!track)
            throw new NotFoundError("Track");
        return this.loops.findByTrackId(track.id, profileId);
    }
    async addLoop(trackId, profileId, name, startTime, endTime) {
        const track = await this.tracks.findByTrackId(trackId);
        if (!track)
            throw new NotFoundError("Track");
        const existing = await this.loops.findByTrackId(track.id, profileId);
        const resolvedName = name ?? `Loop ${existing.length + 1}`;
        return this.loops.create(track.id, profileId, resolvedName, startTime, endTime);
    }
    async deleteLoop(loopId) {
        await this.loops.delete(loopId);
    }
    async getCovers(count) {
        return this.trackData.findWithCovers(count);
    }
    async updateTrack(trackId, input) {
        const track = await this.tracks.findByTrackId(trackId);
        if (!track)
            throw new NotFoundError("Track");
        return this.tracks.update(track.id, input);
    }
    async deleteTrack(trackId) {
        const track = await this.tracks.findByTrackId(trackId);
        if (!track)
            throw new NotFoundError("Track");
        const data = await this.trackData.findByTrackId(track.id);
        if (data) {
            const storageIds = [data.coverImageStorageId, data.audioFileStorageId].filter(Boolean);
            await Promise.all(storageIds.map((id) => this.storage.delete(id).catch(() => { })));
            await this.songs.delete(data.originalFilename);
            await this.trackData.delete(data.id);
        }
        const stemsRecord = await this.stems.findByTrackId(track.id);
        if (stemsRecord) {
            const stemRows = await this.stemData.findByStemsId(stemsRecord.id);
            const stemStorageIds = stemRows.map((s) => s.stemAudioFileStorageId).filter(Boolean);
            await Promise.all(stemStorageIds.map((id) => this.storage.delete(id).catch(() => { })));
            await Promise.all(stemRows.map((s) => this.stemData.delete(s.id).catch(() => { })));
            await this.stems.delete(stemsRecord.id).catch(() => { });
        }
        await this.loops.deleteAllByTrackId(track.id);
        await this.favorites.deleteByTrackId(trackId);
        await this.tracks.delete(track.id);
    }
}
//# sourceMappingURL=TrackService.js.map