import type { FastifyBaseLogger } from "fastify";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import type { ISongRepository, ITrackRepository, ITrackDataRepository, IStemsRepository, IStemDataRepository } from "../domain/repositories.js";
import type { SongInput } from "../domain/repositories.js";
import type { ImportJob, ImportResult } from "../domain/models/import.js";
import type { IStorageService } from "../domain/interfaces/services/IStorageService.js";
import type { Config } from "../config.js";
import type { IImportFormatProvider } from "../domain/interfaces/providers/IImportFormatProvider.js";
import { IMPORT_FORMAT_PROVIDER_TYPE } from "../domain/interfaces/providers/IImportFormatProvider.js";
import type { ProviderRegistry } from "../infrastructure/plugins/ProviderRegistry.js";
import type { HookSystem } from "../infrastructure/plugins/HookSystem.js";

type MutableJob = {
  -readonly [K in keyof ImportJob]: ImportJob[K];
};

const MAX_CONCURRENT = 2;

export class ImportService {
  private queue = new Map<string, MutableJob>();
  private results = new Map<string, ImportResult>();
  private limiter = pLimit(MAX_CONCURRENT);
  private running = 0;

  constructor(
    private readonly songs: ISongRepository,
    private readonly tracks: ITrackRepository,
    private readonly trackData: ITrackDataRepository,
    private readonly stemsRepo: IStemsRepository,
    private readonly stemDataRepo: IStemDataRepository,
    private readonly storage: IStorageService,
    private readonly config: Config,
    private readonly providers: ProviderRegistry,
    private readonly hooks: HookSystem,
    private readonly logger: FastifyBaseLogger,
  ) {}

  enqueue(filename: string, profileId: number): ImportJob | null {
    const filePath = this.config.dlcDir
      ? path.resolve(this.config.dlcDir, filename)
      : filename;
    const provider = this.findProvider(filePath);
    if (!provider) return null;

    const id = randomUUID();
    const job: MutableJob = {
      id,
      profileId,
      filename,
      format: provider.name,
      status: "queued",
      progress: 0,
      error: null,
      trackId: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };
    this.queue.set(id, job);
    this.hooks.emit("import:queued", { jobId: id, filename, format: provider.name, profileId }).catch(() => undefined);
    this.limiter(() => this.processJob(job)).catch(() => undefined);
    return { ...job };
  }

  getStatus(jobId: string): ImportJob | null {
    const job = this.queue.get(jobId);
    return job ? { ...job } : null;
  }

  getAllJobs(): ImportJob[] {
    return [...this.queue.values()].map((j) => ({ ...j }));
  }

  getResult(jobId: string): ImportResult | null {
    return this.results.get(jobId) ?? null;
  }

  private findProvider(filePath: string): IImportFormatProvider | null {
    const all = this.providers.getAll<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE);
    return all.find((p) => p.canHandle(filePath)) ?? null;
  }

  private async processJob(job: MutableJob): Promise<void> {
    this.running++;
    job.status = "processing";
    job.startedAt = Date.now();
    job.progress = 5;

    try {
      const dlcDir = this.config.dlcDir;
      if (!dlcDir) throw new Error("DLC_DIR not configured");

      const filePath = path.resolve(dlcDir, job.filename);
      if (!filePath.startsWith(path.resolve(dlcDir))) throw new Error("Path traversal detected");

      const stat = await fs.stat(filePath);
      if (!stat.isFile() && !stat.isDirectory()) throw new Error(`Not a file or directory: ${job.filename}`);

      const beforePayload = await this.hooks.emit("import:before", { jobId: job.id, filename: job.filename, format: job.format, filePath });
      if ((beforePayload as { aborted?: boolean }).aborted) {
        job.status = "failed";
        job.error = "Import cancelled by plugin";
        job.completedAt = Date.now();
        this.running--;
        return;
      }

      job.progress = 10;

      const provider = this.findProvider(filePath);
      if (!provider) throw new Error(`No format provider for: ${job.filename}`);

      const formatConfig = {
        sloppakCacheDir: this.config.sloppakCacheDir,
        audioCacheDir: this.config.audioCacheDir,
      };

      const meta = provider.extractMeta(filePath, formatConfig);
      job.progress = 30;

      const trackId = `track_${job.id}`;
      const songInput = this.buildSongInput(job.filename, stat, meta, job.format);
      await this.songs.upsert(job.filename, songInput);
      job.progress = 50;

      const existing = await this.trackData.findByOriginalFilename(job.filename);
      if (existing) {
        job.trackId = String(existing.trackId);
        job.status = "completed";
        job.progress = 100;
        job.completedAt = Date.now();
        this.running--;
        return;
      }

      const track = await this.tracks.create({
        trackId,
        title: songInput.title || undefined,
        artist: songInput.artist || undefined,
        album: songInput.album || undefined,
        year: songInput.year || undefined,
        duration: songInput.duration || undefined,
        tuning: songInput.tuning || undefined,
        hasLyrics: songInput.hasLyrics || undefined,
        format: songInput.format,
        tuningName: songInput.tuningName || undefined,
        tuningSortKey: songInput.tuningSortKey || undefined,
      });
      job.trackId = track.trackId;
      job.progress = 60;

      const arrangements = (meta.arrangements ?? []) as { index: number; name: string; notes: number }[];

      let coverImageStorageId: string | undefined;
      let audioFileStorageId: string | undefined;

      try {
        const artBuffer = provider.extractCoverArt(filePath, formatConfig);
        if (artBuffer) {
          const artId = `cover_${trackId}`;
          await this.storage.store(artId, artBuffer);
          coverImageStorageId = artId;
        }
      } catch (err) {
        this.logger.warn({ err, filename: job.filename }, `Failed to extract/store cover art`);
      }
      job.progress = 70;

      try {
        const audioPath = await provider.extractAudio(filePath, trackId, formatConfig);
        if (audioPath) {
          const audioId = `audio_${trackId}`;
          await this.storage.storeFromPath(audioId, audioPath);
          audioFileStorageId = audioId;
        }
      } catch (err) {
        this.logger.warn({ err, filename: job.filename }, `Failed to extract/store audio`);
      }
      job.progress = 80;

      await this.trackData.create(track.id, job.filename, arrangements, coverImageStorageId, audioFileStorageId);
      job.progress = 85;

      const stemIds = (meta.stemIds ?? []) as string[];
      const stemCount = Number(meta.stemCount) || stemIds.length;

      if (stemCount > 0) {
        const stemsRecord = await this.stemsRepo.create(track.id);
        for (let i = 0; i < stemIds.length; i++) {
          await this.stemDataRepo.create(stemsRecord.id, i);
        }
      }
      job.progress = 95;

      const result: ImportResult = {
        jobId: job.id,
        trackId,
        title: songInput.title,
        artist: songInput.artist,
        duration: songInput.duration,
        format: job.format,
        stemCount,
        stemIds,
        coverArtStored: coverImageStorageId !== undefined,
        audioStored: audioFileStorageId !== undefined,
      };
      this.results.set(job.id, result);

      job.status = "completed";
      job.progress = 100;
      job.completedAt = Date.now();

      await this.hooks.emit("import:complete", {
        jobId: job.id, trackId, title: songInput.title,
        artist: songInput.artist, format: job.format,
      }).catch(() => undefined);
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = Date.now();
      await this.hooks.emit("import:failed", {
        jobId: job.id, filename: job.filename, format: job.format, error: job.error,
      }).catch(() => undefined);
    } finally {
      this.running--;
    }
  }

  private buildSongInput(filename: string, stat: fsSync.Stats, meta: Record<string, unknown>, format: string): SongInput {
    return {
      mtime: stat.mtimeMs / 1000,
      size: stat.size,
      title: String(meta.title ?? ""),
      artist: String(meta.artist ?? ""),
      album: String(meta.album ?? ""),
      year: String(meta.year ?? ""),
      duration: Number(meta.duration) || 0,
      tuning: String(meta.tuning ?? ""),
      tuningName: String(meta.tuningName ?? ""),
      tuningSortKey: Number(meta.tuningSortKey) || 0,
      arrangements: (meta.arrangements ?? []) as { index: number; name: string; notes: number }[],
      hasLyrics: Boolean(meta.hasLyrics),
      format,
      stemCount: Number(meta.stemCount) || 0,
      stemIds: (meta.stemIds ?? []) as string[],
    };
  }
}
