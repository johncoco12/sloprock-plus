import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import {
  loadScore,
  scoreMetadata,
  scoreTracks,
  scoreTuning,
  scoreDuration,
  buildTrackHighway,
} from "./GpifParser.js";
import { readSidecar } from "./GuitarProImportRoute.js";
import { tuningName, tuningSortKey } from "../../../backend/src/infrastructure/formats/tunings.js";
import type { ArrangementData } from "../../../backend/src/domain/models/track.js";
import type { HighwayResponse } from "../../../backend/src/domain/models/highway.js";
import type {
  IImportFormatProvider,
  ImportFormatConfig,
} from "../../../backend/src/domain/interfaces/providers/IImportFormatProvider.js";

const GP_EXTS = new Set([".gp", ".gpx"]);

export class GuitarProFormatProvider implements IImportFormatProvider {
  readonly name = "guitarpro";

  canHandle(filePath: string): boolean {
    return GP_EXTS.has(path.extname(filePath).toLowerCase());
  }

  extractMeta(filePath: string, _config: ImportFormatConfig): Record<string, unknown> {
    try {
      const score = loadScore(filePath);
      if (!score) return this.emptyMeta(filePath);

      const sidecar = readSidecar(filePath);
      const { title, artist, album } = scoreMetadata(score);
      const { offsets, stringCount } = scoreTuning(score, 0);

      return {
        title:         sidecar?.title  ?? title,
        artist:        sidecar?.artist ?? artist,
        album:         sidecar?.album  ?? album,
        year:          "",
        duration:      scoreDuration(score),
        tuning:        offsets.join(","),
        tuningName:    tuningName(offsets),
        tuningSortKey: tuningSortKey(offsets),
        arrangements:  scoreTracks(score),
        hasLyrics:     false,
        format:        "guitarpro",
        stemCount:     0,
        stemIds:       [],
      };
    } catch {
      return this.emptyMeta(filePath);
    }
  }

  extractCoverArt(filePath: string, _config: ImportFormatConfig): Buffer | null {
    try {
      const sidecar = readSidecar(filePath);
      if (sidecar?.coverArtPath && fs.existsSync(sidecar.coverArtPath)) {
        return fs.readFileSync(sidecar.coverArtPath);
      }
    } catch { /* fall through */ }
    return null;
  }

  async extractAudio(
    filePath: string,
    trackId: string,
    config: ImportFormatConfig,
  ): Promise<string | null> {
    try {
      const sidecar = readSidecar(filePath);
      if (sidecar?.audioPath && fs.existsSync(sidecar.audioPath)) {
        return sidecar.audioPath;
      }

      // Fall back to OGG embedded in GP6 archives
      const zip = new AdmZip(filePath);
      for (const entry of zip.getEntries()) {
        if (entry.entryName.toLowerCase().endsWith(".ogg")) {
          const data = zip.readFile(entry);
          if (!data) continue;
          await fs.promises.mkdir(config.audioCacheDir, { recursive: true });
          const outPath = path.join(config.audioCacheDir, `${trackId}.ogg`);
          await fs.promises.writeFile(outPath, data);
          return outPath;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  loadHighway(
    filePath: string,
    arrangements: ArrangementData[],
    arrangementIndex: number,
    _config: ImportFormatConfig,
  ): HighwayResponse {
    try {
      const score = loadScore(filePath);
      if (!score) return this.emptyHighway(arrangements, arrangementIndex);

      const sidecar = readSidecar(filePath);
      const { title, artist, album } = scoreMetadata(score);

      const arrMeta = arrangements[arrangementIndex] ?? {
        index: arrangementIndex,
        name: score.tracks[0]?.name ?? "Guitar",
        notes: 0,
      };
      const arrangementsList = arrangements.map((a) => ({ index: a.index, name: a.name, notes: a.notes }));

      // Match track by name, fall back to index
      const targetName = arrMeta.name.toLowerCase();
      let trackIdx = score.tracks.findIndex((t) => t.name.toLowerCase() === targetName);
      if (trackIdx === -1)
        trackIdx = score.tracks.findIndex(
          (t) => t.name.toLowerCase().includes(targetName) || targetName.includes(t.name.toLowerCase()),
        );
      if (trackIdx === -1) trackIdx = arrangementIndex < score.tracks.length ? arrangementIndex : 0;

      const hw = buildTrackHighway(score, trackIdx);

      return {
        song_info: {
          title:             sidecar?.title  ?? title,
          artist:            sidecar?.artist ?? artist,
          album:             sidecar?.album  ?? album,
          arrangement:       arrMeta.name,
          arrangement_index: arrangementIndex,
          arrangements:      arrangementsList,
          duration:          hw.duration,
          tuning:            hw.tuningOffsets,
          capo:              hw.capo,
          offset:            0,
          stringCount:       hw.stringCount,
          format:            "guitarpro",
        },
        beats:           hw.beatMarkers,
        sections:        hw.sections,
        anchors:         hw.anchors,
        chord_templates: hw.chordTemplates,
        lyrics:          [],
        tone_changes:    [],
        tone_base:       "",
        notes:           hw.notes,
        chords:          hw.chords,
        handshapes:      hw.handshapes,
      };
    } catch {
      return this.emptyHighway(arrangements, arrangementIndex);
    }
  }

  private emptyMeta(filePath: string): Record<string, unknown> {
    const base = path.basename(filePath, path.extname(filePath));
    return {
      title: base, artist: "", album: "", year: "",
      duration: 0, tuning: "0,0,0,0,0,0",
      tuningName: "E Standard", tuningSortKey: 0,
      arrangements: [{ index: 0, name: "Guitar", notes: 0 }],
      hasLyrics: false, format: "guitarpro", stemCount: 0, stemIds: [],
    };
  }

  private emptyHighway(
    arrangements: ArrangementData[],
    arrangementIndex: number,
    meta?: { title?: string; artist?: string; album?: string },
  ): HighwayResponse {
    const arrMeta = arrangements[arrangementIndex] ?? { index: arrangementIndex, name: "Guitar", notes: 0 };
    return {
      song_info: {
        title: meta?.title ?? "", artist: meta?.artist ?? "", album: meta?.album ?? "",
        arrangement: arrMeta.name, arrangement_index: arrangementIndex,
        arrangements: arrangements.map((a) => ({ index: a.index, name: a.name, notes: a.notes })),
        duration: 0, tuning: [0, 0, 0, 0, 0, 0], capo: 0, offset: 0, stringCount: 6,
        format: "guitarpro",
      },
      beats: [], sections: [], anchors: [], chord_templates: [],
      lyrics: [], tone_changes: [], tone_base: "",
      notes: [], chords: [], handshapes: [],
    };
  }
}
