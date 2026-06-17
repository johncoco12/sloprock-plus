import path from "node:path";
import type { ITrackRepository, ITrackDataRepository } from "../domain/repositories.js";
import type { Config } from "../config.js";
import type { HighwayResponse } from "../domain/models/highway.js";
import type { ArrangementData } from "../domain/models/track.js";
import type { IImportFormatProvider } from "../domain/interfaces/providers/IImportFormatProvider.js";
import { IMPORT_FORMAT_PROVIDER_TYPE } from "../domain/interfaces/providers/IImportFormatProvider.js";
import type { ProviderRegistry } from "../infrastructure/plugins/ProviderRegistry.js";

export type { HighwayResponse };

export class HighwayService {
  constructor(
    private readonly tracks: ITrackRepository,
    private readonly trackData: ITrackDataRepository,
    private readonly config: Config,
    private readonly providers: ProviderRegistry,
  ) {}

  async getHighwayData(
    trackId: string,
    arrangementIndex: number,
  ): Promise<HighwayResponse> {
    const track = await this.tracks.findByTrackId(trackId);
    if (!track) throw new Error("Track not found");

    const data = await this.trackData.findByTrackId(track.id);
    if (!data) throw new Error("TrackData not found");

    const dlcDir = this.config.dlcDir;
    if (!dlcDir) throw new Error("DLC_DIR not configured");

    const filePath = path.resolve(dlcDir, data.originalFilename);
    if (!filePath.startsWith(path.resolve(dlcDir))) throw new Error("Path traversal detected");

    const all = this.providers.getAll<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE);
    const provider = all.find((p) => p.canHandle(filePath));
    if (!provider) throw new Error(`No format provider for: ${data.originalFilename}`);

    const formatConfig = {
      sloppakCacheDir: this.config.sloppakCacheDir,
      audioCacheDir: this.config.audioCacheDir,
      rscliPath: this.config.rscliPath,
    };

    return provider.loadHighway(
      filePath,
      data.arrangements as ArrangementData[],
      arrangementIndex,
      formatConfig,
    );
  }
}
