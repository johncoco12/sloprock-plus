import type { WireNote, WireChord, WireAnchor, WireHandShape, WireChordTemplate, WirePhrase } from "./song.js";
export interface HighwaySongInfo {
    readonly title?: string;
    readonly artist?: string;
    readonly album?: string;
    readonly arrangement?: string;
    readonly arrangement_index: number;
    readonly arrangements: readonly {
        index: number;
        name: string;
        notes: number;
    }[];
    readonly duration?: number;
    readonly tuning: number[];
    readonly capo: number;
    readonly offset: number;
    readonly stringCount: number;
    readonly format?: string;
}
export interface HighwayResponse {
    readonly song_info: HighwaySongInfo;
    readonly beats: readonly {
        time: number;
        measure: number;
    }[];
    readonly sections: readonly {
        time: number;
        name: string;
    }[];
    readonly anchors: readonly WireAnchor[];
    readonly chord_templates: readonly WireChordTemplate[];
    readonly lyrics: readonly {
        t: number;
        d: number;
        w: string;
    }[];
    readonly tone_changes: readonly {
        time: number;
        name: string;
    }[];
    readonly tone_base: string;
    readonly notes: readonly WireNote[];
    readonly chords: readonly WireChord[];
    readonly handshapes: readonly WireHandShape[];
    readonly phrases?: readonly WirePhrase[];
}
//# sourceMappingURL=highway.d.ts.map