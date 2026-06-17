import fs from "node:fs";
import path from "node:path";
import { SloppakLoader } from "./SloppakLoader.js";
import {
  parseSongRoot,
  parseLyricsXml,
  arrangementFromWireJson,
} from "../../../backend/src/infrastructure/formats/ArrangementParser.js";
import {
  toWireNote,
  toWireChord,
  toWireAnchor,
  toWireHandShape,
  toWireChordTemplate,
  toWirePhrase,
  arrangementStringCount,
} from "../../../backend/src/domain/models/song.js";
import type { ArrangementData } from "../../../backend/src/domain/models/track.js";
import type { HighwayResponse } from "../../../backend/src/domain/models/highway.js";
import type { IImportFormatProvider, ImportFormatConfig } from "../../../backend/src/domain/interfaces/providers/IImportFormatProvider.js";

export class SloppakFormatProvider implements IImportFormatProvider {
  readonly name = "sloppak";

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith(".sloppak");
  }

  extractMeta(filePath: string, config: ImportFormatConfig): Record<string, unknown> {
    return SloppakLoader.extractMeta(filePath, config.sloppakCacheDir);
  }

  extractCoverArt(filePath: string, config: ImportFormatConfig): Buffer | null {
    try {
      const sourceDir = SloppakLoader.resolveDir(filePath, config.sloppakCacheDir);
      for (const ext of [".png", ".jpg", ".jpeg"]) {
        const artPath = path.join(sourceDir, `cover${ext}`);
        if (fs.existsSync(artPath)) return fs.readFileSync(artPath);
      }
      return null;
    } catch {
      return null;
    }
  }

  resolveStaticFile(filename: string, relPath: string, config: ImportFormatConfig): string | null {
    if (relPath.includes("..") || relPath.startsWith("/") || relPath.includes("\\")) return null;
    const sloppakName = path.basename(filename, path.extname(filename));
    const sloppakDir = path.join(config.sloppakCacheDir, sloppakName);
    const resolved = path.resolve(sloppakDir, relPath);
    if (!resolved.startsWith(path.resolve(sloppakDir) + path.sep)) return null;
    if (!fs.existsSync(resolved)) return null;
    return resolved;
  }

  async extractAudio(filePath: string, _trackId: string, config: ImportFormatConfig): Promise<string | null> {
    try {
      const sourceDir = SloppakLoader.resolveDir(filePath, config.sloppakCacheDir);
      const manifest = SloppakLoader.readManifest(sourceDir);
      const fullStem = manifest.stems?.find((s) => s.default) ?? manifest.stems?.[0];
      if (!fullStem) return null;
      const audioPath = path.join(sourceDir, fullStem.file);
      try { await fs.promises.access(audioPath); return audioPath; } catch { return null; }
    } catch {
      return null;
    }
  }

  loadHighway(
    filePath: string,
    arrangements: ArrangementData[],
    arrangementIndex: number,
    config: ImportFormatConfig,
  ): HighwayResponse {
    const sourceDir = SloppakLoader.resolveDir(filePath, config.sloppakCacheDir);
    const manifest = SloppakLoader.readManifest(sourceDir);

    const arrMeta = arrangements[arrangementIndex] ?? { index: arrangementIndex, name: "Lead", notes: 0 };
    const arrangementsList = arrangements.map((a) => ({ index: a.index, name: a.name, notes: a.notes }));

    const manArr = manifest.arrangements?.find(
      (a) => a.name.toLowerCase() === arrMeta.name.toLowerCase(),
    );
    const arrFile = manArr ? path.join(sourceDir, "arrangements", manArr.file) : null;

    let beats: { time: number; measure: number }[] = [];
    let sections: { time: number; name: string }[] = [];
    let songLength = manifest.duration ?? 0;
    let offset = 0;
    let title = manifest.title ?? "";
    let artist = manifest.artist ?? "";
    let album = manifest.album ?? "";

    const songXmlPath = path.join(sourceDir, "song.xml");
    if (fs.existsSync(songXmlPath)) {
      const root = parseSongRoot(fs.readFileSync(songXmlPath, "utf8"));
      if (root) {
        if (root.beats.length) beats = root.beats.map((b) => ({ time: b.time, measure: b.measure }));
        if (root.sections.length) sections = root.sections.map((s) => ({ time: s.startTime, name: s.name }));
        songLength = root.songLength || songLength;
        offset = root.offset;
      }
    }

    let lyrics: { t: number; d: number; w: string }[] = [];
    if (manifest.lyrics) {
      const lyricsPath = path.join(sourceDir, manifest.lyrics);
      if (fs.existsSync(lyricsPath)) {
        try {
          if (lyricsPath.endsWith(".json")) {
            lyrics = JSON.parse(fs.readFileSync(lyricsPath, "utf8"));
          } else {
            lyrics = parseLyricsXml(fs.readFileSync(lyricsPath, "utf8")) as unknown as typeof lyrics;
          }
        } catch { }
      }
    }

    if (!arrFile || !fs.existsSync(arrFile)) {
      return {
        song_info: { title, artist, album, arrangement: arrMeta.name, arrangement_index: arrangementIndex, arrangements: arrangementsList, duration: songLength, tuning: [0, 0, 0, 0, 0, 0], capo: 0, offset, stringCount: 6, format: "sloppak" },
        beats, sections, anchors: [], chord_templates: [], lyrics, tone_changes: [], tone_base: "", notes: [], chords: [], handshapes: [],
      };
    }

    const arrData = JSON.parse(fs.readFileSync(arrFile, "utf8")) as Record<string, unknown>;

    if (beats.length === 0) {
      const beatsRaw = arrData["beats"] as Record<string, unknown>[] | undefined;
      if (beatsRaw) beats = beatsRaw.map((b) => ({ time: (b.time as number) ?? 0, measure: (b.measure as number) ?? -1 }));
    }
    if (sections.length === 0) {
      const sectionsRaw = arrData["sections"] as Record<string, unknown>[] | undefined;
      if (sectionsRaw) sections = sectionsRaw.map((s) => ({ time: (s.time ?? s.start_time ?? 0) as number, name: (s.name as string) ?? "" }));
    }

    const arr = arrangementFromWireJson(arrData);
    const stringCount = arrangementStringCount(arr);
    const toneChanges: { time: number; name: string }[] = [];
    let toneBase = "";
    if (arr.tones) {
      toneBase = arr.tones.base;
      for (const tc of arr.tones.changes) toneChanges.push({ time: tc.time, name: tc.name });
    }

    return {
      song_info: { title, artist, album, arrangement: arr.name, arrangement_index: arrangementIndex, arrangements: arrangementsList, duration: songLength, tuning: [...arr.tuning], capo: arr.capo, offset, stringCount, format: "sloppak" },
      beats, sections,
      anchors: arr.anchors.map(toWireAnchor),
      chord_templates: arr.chordTemplates.map(toWireChordTemplate),
      lyrics, tone_changes: toneChanges, tone_base: toneBase,
      notes: arr.notes.map(toWireNote),
      chords: arr.chords.map(toWireChord),
      handshapes: arr.handShapes.map(toWireHandShape),
      phrases: arr.phrases ? arr.phrases.map(toWirePhrase) : undefined,
    };
  }
}
