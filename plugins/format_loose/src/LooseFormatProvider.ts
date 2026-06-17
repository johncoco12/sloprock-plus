import fs from "node:fs";
import path from "node:path";
import { LooseFolderReader, findWemFiles } from "./LooseFolderReader.js";
import { AudioConverterAsync } from "../../../backend/src/infrastructure/audio/AudioConverterAsync.js";
import {
  parseArrangementXml,
  parseSongRoot,
  parseLyricsXml,
  arrangementDisplayName,
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

function walkXmlFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".xml") && !entry.name.includes("_showlights")) results.push(full);
    }
  }
  walk(dir);
  return results;
}

export class LooseFormatProvider implements IImportFormatProvider {
  readonly name = "loose";

  canHandle(filePath: string): boolean {
    return LooseFolderReader.isLooseFolder(filePath);
  }

  extractMeta(filePath: string): Record<string, unknown> {
    return LooseFolderReader.extractMeta(filePath);
  }

  extractCoverArt(filePath: string): Buffer | null {
    try {
      for (const ext of [".png", ".jpg", ".jpeg"]) {
        const artPath = path.join(filePath, `cover${ext}`);
        if (fs.existsSync(artPath)) return fs.readFileSync(artPath);
      }
      return null;
    } catch {
      return null;
    }
  }

  async extractAudio(filePath: string, trackId: string, config: ImportFormatConfig): Promise<string | null> {
    try {
      const wems = findWemFiles(filePath);
      if (wems.length === 0) return null;
      await fs.promises.mkdir(config.audioCacheDir, { recursive: true });
      const outputBase = path.join(config.audioCacheDir, trackId);
      return await AudioConverterAsync.convertWem(wems[0], outputBase);
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
    const arrMeta = arrangements[arrangementIndex] ?? { index: arrangementIndex, name: "Lead", notes: 0 };
    const arrangementsList = arrangements.map((a) => ({ index: a.index, name: a.name, notes: a.notes }));
    const xmlFiles = walkXmlFiles(filePath);

    let title = "", artist = "", album = "";
    let songLength = 0, offset = 0;
    let beats: { time: number; measure: number }[] = [];
    let sections: { time: number; name: string }[] = [];
    let vocalsXml = "";
    const arrXmls: { name: string; xml: string }[] = [];

    for (const f of xmlFiles) {
      const content = fs.readFileSync(f, "utf8");
      if (f.toLowerCase().includes("vocal")) { vocalsXml = content; continue; }

      const root = parseSongRoot(content);
      if (root) {
        if (!title) { title = root.title; artist = root.artist; album = root.album; }
        if (!songLength && root.songLength) songLength = root.songLength;
        if (!offset && root.offset) offset = root.offset;
        if (!beats.length && root.beats.length > 0) beats = root.beats.map((b) => ({ time: b.time, measure: b.measure }));
        if (!sections.length && root.sections.length > 0) sections = root.sections.map((s) => ({ time: s.startTime, name: s.name }));
      }

      const stem = path.basename(f, ".xml").toLowerCase();
      arrXmls.push({ name: arrangementDisplayName(stem, path.basename(f, ".xml")), xml: content });
    }

    const targetLower = arrMeta.name.toLowerCase();
    let matchIdx = arrXmls.findIndex((x) => x.name.toLowerCase() === targetLower);
    if (matchIdx === -1) matchIdx = arrXmls.findIndex((x) => x.name.toLowerCase().includes(targetLower) || targetLower.includes(x.name.toLowerCase()));
    if (matchIdx === -1 && arrXmls.length > 0) matchIdx = 0;

    let lyrics: { t: number; d: number; w: string }[] = [];
    if (vocalsXml) {
      try { lyrics = parseLyricsXml(vocalsXml) as unknown as typeof lyrics; } catch { }
    }

    if (matchIdx === -1) {
      return {
        song_info: { title, artist, album, arrangement: arrMeta.name, arrangement_index: arrangementIndex, arrangements: arrangementsList, duration: songLength, tuning: [0, 0, 0, 0, 0, 0], capo: 0, offset, stringCount: 6, format: "loose" },
        beats, sections, anchors: [], chord_templates: [], lyrics, tone_changes: [], tone_base: "", notes: [], chords: [], handshapes: [],
      };
    }

    const arr = parseArrangementXml(arrXmls[matchIdx].xml);
    const stringCount = arrangementStringCount(arr);
    const toneChanges: { time: number; name: string }[] = [];
    let toneBase = "";
    if (arr.tones) {
      toneBase = arr.tones.base;
      for (const tc of arr.tones.changes) toneChanges.push({ time: tc.time, name: tc.name });
    }

    return {
      song_info: { title, artist, album, arrangement: arr.name, arrangement_index: arrangementIndex, arrangements: arrangementsList, duration: songLength, tuning: [...arr.tuning], capo: arr.capo, offset, stringCount, format: "loose" },
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
