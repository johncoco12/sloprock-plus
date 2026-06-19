import { readFileSync } from "node:fs";
import { importer, Settings, model } from "@coderline/alphatab";
import type {
  WireNote,
  WireChord,
  WireChordNote,
  WireChordTemplate,
  WireHandShape,
  WireAnchor,
} from "../../../backend/src/domain/models/song.js";

const STANDARD_MIDI: Record<number, number[]> = {
  4: [28, 33, 38, 43],
  5: [23, 28, 33, 38, 43],
  6: [40, 45, 50, 55, 59, 64],
  7: [35, 40, 45, 50, 55, 59, 64],
  8: [30, 35, 40, 45, 50, 55, 59, 64],
};

export interface TrackHighway {
  notes: WireNote[];
  chords: WireChord[];
  chordTemplates: WireChordTemplate[];
  handshapes: WireHandShape[];
  anchors: WireAnchor[];
  beatMarkers: { time: number; measure: number }[];
  sections: { time: number; name: string }[];
  tuningOffsets: number[];
  capo: number;
  stringCount: number;
  duration: number;
  name: string;
}

function beatDurationFraction(beat: model.Beat): number {
  const dur = beat.duration;
  let frac = dur > 0 ? 1 / dur : 0.25;
  if (beat.dots > 0) {
    let extra = frac / 2;
    for (let i = 0; i < beat.dots; i++) { frac += extra; extra /= 2; }
  }
  const num = beat.tupletNumerator;
  const den = beat.tupletDenominator;
  if (num > 0 && den > 0 && num !== den) frac *= den / num;
  return frac;
}

function barBpm(masterBar: model.MasterBar, prev: number): number {
  for (const auto of masterBar.tempoAutomations) {
    if (auto.type === 0 /* Tempo */) return auto.value;
  }
  return prev;
}

export function loadScore(filePath: string): model.Score | null {
  try {
    const buf = readFileSync(filePath);
    const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return importer.ScoreLoader.loadScoreFromBytes(data, new Settings());
  } catch {
    return null;
  }
}

export function scoreMetadata(score: model.Score) {
  return { title: score.title, artist: score.artist, album: score.album };
}

export function scoreTracks(score: model.Score) {
  return score.tracks.map((t, i) => ({ index: i, name: t.name, notes: 0 }));
}

export function scoreTuning(score: model.Score, trackIdx: number) {
  const staff = score.tracks[trackIdx]?.staves[0];
  if (!staff) return { offsets: [0, 0, 0, 0, 0, 0], stringCount: 6 };
  // alphatab stores tunings high→low; reverse to low→high
  const midiLowToHigh = [...staff.stringTuning.tunings].reverse();
  const stringCount = midiLowToHigh.length || 6;
  const standard = STANDARD_MIDI[stringCount] ?? midiLowToHigh;
  return {
    offsets: midiLowToHigh.map((m, i) => m - (standard[i] ?? m)),
    stringCount,
  };
}

export function scoreDuration(score: model.Score): number {
  let t = 0;
  let bpm = 120;
  for (const mb of score.masterBars) {
    bpm = barBpm(mb, bpm);
    t += (mb.timeSignatureNumerator / mb.timeSignatureDenominator) * (60 / bpm) * 4;
  }
  return Math.round(t * 1000) / 1000;
}

export function buildTrackHighway(score: model.Score, trackIdx: number): TrackHighway {
  const track = score.tracks[trackIdx];
  if (!track) throw new Error(`GP track ${trackIdx} not found`);
  const staff = track.staves[0];
  if (!staff) throw new Error(`GP track ${trackIdx} has no staff`);

  const { offsets: tuningOffsets, stringCount } = scoreTuning(score, trackIdx);

  // Build chord template map from staff chord diagrams
  const chordTemplateMap = new Map<string, number>();
  const chordTemplates: WireChordTemplate[] = [];
  let anonymousTemplateIdx = -1;

  const staffChords = (staff as unknown as { chords: Map<string, { name: string }> }).chords;
  if (staffChords instanceof Map) {
    for (const [id, chord] of staffChords) {
      chordTemplateMap.set(id, chordTemplates.length);
      chordTemplates.push({ name: chord.name ?? "", frets: [], fingers: [] });
    }
  }

  function getOrCreateAnonymousTemplate(): number {
    if (anonymousTemplateIdx === -1) {
      anonymousTemplateIdx = chordTemplates.length;
      chordTemplates.push({ name: "", frets: [], fingers: [] });
    }
    return anonymousTemplateIdx;
  }

  interface NoteEvent {
    time: number; duration: number;
    string: number; fret: number;
    hammerOn: boolean; pullOff: boolean; vibrato: boolean; palmMute: boolean;
    muted: boolean; harmonic: boolean; pinchHarmonic: boolean;
    tapped: boolean; accent: boolean;
    pitchSlide: boolean; unpitchedSlide: boolean;
    bendSemitones: number; slideTargetFret: number;
  }

  const allNoteEvents: NoteEvent[] = [];
  const beatGroups: { time: number; duration: number; events: NoteEvent[]; chordId?: string }[] = [];
  const beatMarkers: { time: number; measure: number }[] = [];
  const sections: { time: number; name: string }[] = [];
  const lastNoteOnString = new Map<number, number>(); // string → eventIdx

  let currentTime = 0;
  let bpm = 120;

  for (let barIdx = 0; barIdx < score.masterBars.length; barIdx++) {
    const masterBar = score.masterBars[barIdx];
    bpm = barBpm(masterBar, bpm);
    const secPerWhole = (60 / bpm) * 4;

    if (masterBar.section?.text) sections.push({ time: currentTime, name: masterBar.section.text });

    const bar = staff.bars[barIdx];
    if (!bar) { currentTime += (masterBar.timeSignatureNumerator / masterBar.timeSignatureDenominator) * secPerWhole; continue; }

    const voice = bar.voices[0];
    if (!voice?.beats) { currentTime += (masterBar.timeSignatureNumerator / masterBar.timeSignatureDenominator) * secPerWhole; continue; }

    let firstBeat = true;
    for (const beat of voice.beats) {
      const beatSec = beatDurationFraction(beat) * secPerWhole;
      beatMarkers.push({ time: currentTime, measure: firstBeat ? barIdx + 1 : -1 });
      firstBeat = false;

      if (!beat.isEmpty && beat.notes.length > 0) {
        const group = { time: currentTime, duration: beatSec, events: [] as NoteEvent[], chordId: beat.chordId ?? undefined };

        for (const note of beat.notes) {
          const slopStr = stringCount - note.string;

          if (note.isTieDestination) {
            const prevIdx = lastNoteOnString.get(slopStr);
            if (prevIdx !== undefined) allNoteEvents[prevIdx].duration += beatSec;
          } else {
            const origin = note.hammerPullOrigin;
            const isHO = origin != null && note.fret >= origin.fret;
            const isPO = origin != null && !isHO;

            const htype = note.harmonicType;
            const harmonic      = htype === 1 || htype === 2 || htype === 4; // Natural/Artificial/Tap
            const pinchHarmonic = htype === 3 || htype === 5;                // Pinch/Semi

            const slideOut = note.slideOutType ?? 0;
            const pitchSlide     = slideOut === 1 || slideOut === 2; // Shift/Legato
            const unpitchedSlide = slideOut === 3 || slideOut === 4; // OutUp/OutDown

            const ev: NoteEvent = {
              time: currentTime, duration: beatSec,
              string: slopStr, fret: note.fret,
              hammerOn: isHO, pullOff: isPO,
              vibrato:      (note.vibrato ?? 0) !== 0,
              palmMute:     note.isPalmMute,
              muted:        note.isDead,
              harmonic, pinchHarmonic,
              tapped:       (beat as unknown as { tap: boolean }).tap || note.isLeftHandTapped,
              accent:       (note.accentuated ?? 0) !== 0,
              pitchSlide, unpitchedSlide,
              bendSemitones:  note.maxBendPoint?.value ?? 0,
              slideTargetFret: -1,
            };
            lastNoteOnString.set(slopStr, allNoteEvents.length);
            allNoteEvents.push(ev);
            group.events.push(ev);
          }
        }

        if (group.events.length > 0) beatGroups.push(group);
      }

      currentTime += beatSec;
    }
  }

  // Resolve pitch-slide targets: each sliding note targets the next note on the same string
  const byString = new Map<number, NoteEvent[]>();
  for (const ev of allNoteEvents) {
    if (!byString.has(ev.string)) byString.set(ev.string, []);
    byString.get(ev.string)!.push(ev);
  }
  for (const [, evs] of byString) {
    evs.sort((a, b) => a.time - b.time);
    for (let i = 0; i < evs.length - 1; i++) {
      if (evs[i].pitchSlide) evs[i].slideTargetFret = evs[i + 1].fret;
    }
  }

  // Convert to wire format
  const wireNotes: WireNote[] = [];
  const wireChords: WireChord[] = [];
  const wireHandshapes: WireHandShape[] = [];

  for (const group of beatGroups) {
    if (group.events.length === 1) {
      const ev = group.events[0];
      const wn: WireNote = { t: ev.time, s: ev.string, f: ev.fret };
      const sus = Math.round(ev.duration * 1000) / 1000;
      if (sus > 0.01)               wn.sus = sus;
      if (ev.pitchSlide && ev.slideTargetFret >= 0) wn.sl = ev.slideTargetFret;
      if (ev.unpitchedSlide)        wn.sl2 = ev.fret;
      if (ev.bendSemitones)         wn.bn  = ev.bendSemitones;
      if (ev.hammerOn)              wn.ho  = true;
      if (ev.pullOff)               wn.po  = true;
      if (ev.harmonic)              wn.hm  = true;
      if (ev.pinchHarmonic)         wn.hp  = true;
      if (ev.palmMute)              wn.pm  = true;
      if (ev.muted)                 wn.mu  = true;
      if (ev.vibrato)               wn.vb  = true;
      if (ev.tapped)                wn.tap = true;
      if (ev.accent)                wn.ac  = true;
      wireNotes.push(wn);
    } else {
      const templateIdx =
        group.chordId !== undefined && chordTemplateMap.has(group.chordId)
          ? chordTemplateMap.get(group.chordId)!
          : getOrCreateAnonymousTemplate();

      const chordNotes: WireChordNote[] = group.events.map((ev) => {
        const cn: WireChordNote = { s: ev.string, f: ev.fret };
        const sus = Math.round(ev.duration * 1000) / 1000;
        if (sus > 0.01)               cn.sus = sus;
        if (ev.pitchSlide && ev.slideTargetFret >= 0) cn.sl = ev.slideTargetFret;
        if (ev.unpitchedSlide)        cn.sl2 = ev.fret;
        if (ev.bendSemitones)         cn.bn  = ev.bendSemitones;
        if (ev.hammerOn)              cn.ho  = true;
        if (ev.pullOff)               cn.po  = true;
        if (ev.palmMute)              cn.pm  = true;
        if (ev.muted)                 cn.mu  = true;
        if (ev.vibrato)               cn.vb  = true;
        if (ev.tapped)                cn.tap = true;
        if (ev.accent)                cn.ac  = true;
        return cn;
      });

      wireChords.push({ t: group.time, id: templateIdx, notes: chordNotes });
      wireHandshapes.push({ id: templateIdx, st: group.time, et: group.time + group.duration });
    }
  }

  return {
    notes: wireNotes,
    chords: wireChords,
    chordTemplates,
    handshapes: wireHandshapes,
    anchors: buildAnchors(wireNotes, wireChords),
    beatMarkers,
    sections,
    tuningOffsets,
    capo: staff.capo,
    stringCount,
    duration: currentTime,
    name: track.name,
  };
}

function buildAnchors(notes: WireNote[], chords: WireChord[]): WireAnchor[] {
  const events: { time: number; fret: number }[] = [];
  for (const n of notes) if (n.f > 0) events.push({ time: n.t, fret: n.f });
  for (const c of chords) {
    const frets = c.notes.map((n) => n.f).filter((f) => f > 0);
    if (frets.length > 0) events.push({ time: c.t, fret: Math.min(...frets) });
  }
  if (events.length === 0) return [{ time: 0, fret: 1, width: 4 }];
  events.sort((a, b) => a.time - b.time);

  const anchors: WireAnchor[] = [];
  let { time: anchorStart, fret: anchorFret } = events[0];
  let anchorHigh = anchorFret;

  for (let i = 1; i < events.length; i++) {
    const { time, fret } = events[i];
    if (Math.abs(fret - anchorFret) > 3) {
      anchors.push({ time: anchorStart, fret: anchorFret, width: Math.max(4, anchorHigh - anchorFret + 1) });
      anchorStart = time; anchorFret = fret; anchorHigh = fret;
    } else {
      anchorFret = Math.min(anchorFret, fret);
      anchorHigh = Math.max(anchorHigh, fret);
    }
  }
  anchors.push({ time: anchorStart, fret: anchorFret, width: Math.max(4, anchorHigh - anchorFret + 1) });
  return anchors;
}
