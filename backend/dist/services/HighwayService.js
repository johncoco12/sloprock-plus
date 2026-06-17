import path from "node:path";
import { IMPORT_FORMAT_PROVIDER_TYPE } from "../domain/interfaces/providers/IImportFormatProvider.js";
export class HighwayService {
    tracks;
    trackData;
    config;
    providers;
    constructor(tracks, trackData, config, providers) {
        this.tracks = tracks;
        this.trackData = trackData;
        this.config = config;
        this.providers = providers;
    }
    async getHighwayData(trackId, arrangementIndex) {
        const track = await this.tracks.findByTrackId(trackId);
        if (!track)
            throw new Error("Track not found");
        const data = await this.trackData.findByTrackId(track.id);
        if (!data)
            throw new Error("TrackData not found");
        const dlcDir = this.config.dlcDir;
        if (!dlcDir)
            throw new Error("DLC_DIR not configured");
        const filePath = path.resolve(dlcDir, data.originalFilename);
        if (!filePath.startsWith(path.resolve(dlcDir)))
            throw new Error("Path traversal detected");
        const all = this.providers.getAll(IMPORT_FORMAT_PROVIDER_TYPE);
        const provider = all.find((p) => p.canHandle(filePath));
        if (!provider)
            throw new Error(`No format provider for: ${data.originalFilename}`);
        const formatConfig = {
            sloppakCacheDir: this.config.sloppakCacheDir,
            audioCacheDir: this.config.audioCacheDir,
            rscliPath: this.config.rscliPath,
        };
        return provider.loadHighway(filePath, data.arrangements, arrangementIndex, formatConfig);
    }
}
//# sourceMappingURL=HighwayService.js.map