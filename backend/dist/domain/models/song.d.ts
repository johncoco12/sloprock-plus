export interface Note {
    readonly time: number;
    readonly string: number;
    readonly fret: number;
    readonly sustain: number;
    readonly slideTo: number;
    readonly slideUnpitchTo: number;
    readonly bend: number;
    readonly hammerOn: boolean;
    readonly pullOff: boolean;
    readonly harmonic: boolean;
    readonly harmonicPinch: boolean;
    readonly palmMute: boolean;
    readonly mute: boolean;
    readonly vibrato: boolean;
    readonly tremolo: boolean;
    readonly accent: boolean;
    readonly linkNext: boolean;
    readonly tap: boolean;
}
export interface ChordNote extends Omit<Note, "time" | "string" | "fret"> {
    readonly string: number;
    readonly fret: number;
}
export interface ChordTemplate {
    readonly name: string;
    readonly displayName: string;
    readonly fingers: readonly number[];
    readonly frets: readonly number[];
    readonly arpeggio: boolean;
}
export interface Chord {
    readonly time: number;
    readonly chordId: number;
    readonly notes: readonly ChordNote[];
    readonly highDensity: boolean;
}
export interface Anchor {
    readonly time: number;
    readonly fret: number;
    readonly width: number;
}
export interface HandShape {
    readonly chordId: number;
    readonly startTime: number;
    readonly endTime: number;
    readonly arpeggio: boolean;
}
export interface Beat {
    readonly time: number;
    readonly measure: number;
}
export interface Section {
    readonly name: string;
    readonly number: number;
    readonly startTime: number;
}
export interface PhraseLevel {
    readonly difficulty: number;
    readonly notes: readonly Note[];
    readonly chords: readonly Chord[];
    readonly anchors: readonly Anchor[];
    readonly handShapes: readonly HandShape[];
}
export interface Phrase {
    readonly startTime: number;
    readonly endTime: number;
    readonly maxDifficulty: number;
    readonly levels: readonly PhraseLevel[];
}
export interface ToneChange {
    readonly time: number;
    readonly name: string;
}
export interface ToneData {
    readonly base: string;
    readonly changes: readonly ToneChange[];
}
export interface Arrangement {
    readonly name: string;
    readonly tuning: readonly number[];
    readonly capo: number;
    readonly notes: readonly Note[];
    readonly chords: readonly Chord[];
    readonly anchors: readonly Anchor[];
    readonly handShapes: readonly HandShape[];
    readonly chordTemplates: readonly ChordTemplate[];
    readonly phrases?: readonly Phrase[];
    readonly tones?: ToneData;
}
export interface LyricWord {
    readonly t: number;
    readonly d: number;
    readonly w: string;
}
export interface Song {
    readonly title: string;
    readonly artist: string;
    readonly album: string;
    readonly year: number;
    readonly songLength: number;
    readonly offset: number;
    readonly beats: readonly Beat[];
    readonly sections: readonly Section[];
    readonly arrangements: readonly Arrangement[];
    readonly lyrics: readonly LyricWord[];
}
export interface WireNote {
    t: number;
    s: number;
    f: number;
    sus?: number;
    sl?: number;
    sl2?: number;
    bn?: number;
    ho?: true;
    po?: true;
    hm?: true;
    hp?: true;
    pm?: true;
    mu?: true;
    vb?: true;
    tr?: true;
    ac?: true;
    ln?: true;
    tap?: true;
}
export interface WireChordNote {
    s: number;
    f: number;
    sus?: number;
    sl?: number;
    sl2?: number;
    bn?: number;
    ho?: true;
    po?: true;
    pm?: true;
    mu?: true;
    vb?: true;
    tr?: true;
    ac?: true;
    ln?: true;
    tap?: true;
}
export interface WireChord {
    t: number;
    id: number;
    hd?: true;
    notes: WireChordNote[];
}
export interface WireAnchor {
    time: number;
    fret: number;
    width: number;
}
export interface WireHandShape {
    id: number;
    st: number;
    et: number;
    arp?: true;
}
export interface WireChordTemplate {
    name: string;
    displayName?: string;
    arp?: true;
    fingers: readonly number[];
    frets: readonly number[];
}
export interface WirePhraseLevel {
    difficulty: number;
    notes: WireNote[];
    chords: WireChord[];
    anchors: WireAnchor[];
    handshapes: WireHandShape[];
}
export interface WirePhrase {
    start_time: number;
    end_time: number;
    max_difficulty: number;
    levels: WirePhraseLevel[];
}
export declare function toWireNote(n: Note): WireNote;
export declare function toWireChordNote(n: ChordNote): WireChordNote;
export declare function toWireChord(c: Chord): WireChord;
export declare function toWireAnchor(a: Anchor): WireAnchor;
export declare function toWireHandShape(h: HandShape): WireHandShape;
export declare function toWireChordTemplate(ct: ChordTemplate): WireChordTemplate;
export declare function toWirePhrase(p: Phrase): WirePhrase;
export declare function noteFromWire(d: Record<string, unknown>): Note;
export declare function chordNoteFromWire(d: Record<string, unknown>, chordTime: number): ChordNote;
export declare function arrangementStringCount(arr: Arrangement): number;
//# sourceMappingURL=song.d.ts.map