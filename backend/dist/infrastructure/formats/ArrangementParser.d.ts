import type { Arrangement, Beat, LyricWord, Section } from "../../domain/models/song.js";
type El = Record<string, unknown>;
export interface ParsedSongRoot {
    readonly title: string;
    readonly artist: string;
    readonly album: string;
    readonly year: number;
    readonly songLength: number;
    readonly offset: number;
    readonly beats: readonly Beat[];
    readonly sections: readonly Section[];
}
export declare function parseSongRoot(xml: string): ParsedSongRoot | null;
export declare function arrangementDisplayName(rawName: string, filenameStem?: string): string;
export declare function extractArrNameFromXml(xml: string): string | null;
export declare function sortArrangementsByPriority<T extends {
    name: string;
}>(arrs: T[]): T[];
export declare function parseArrangementXml(xml: string, arrangementName?: string): Arrangement;
export declare function parseLyricsXml(xml: string): LyricWord[];
export declare function arrangementFromWireJson(data: El): Arrangement;
import type { Song } from "../../domain/models/song.js";
export declare function convertSngToXml(dir: string, rscliPath: string): void;
export declare function loadSongFromDirectory(dir: string, rscliPath?: string): Promise<Song>;
export {};
//# sourceMappingURL=ArrangementParser.d.ts.map