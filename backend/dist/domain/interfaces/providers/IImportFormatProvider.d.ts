import type { ArrangementData } from "../../models/track.js";
import type { HighwayResponse } from "../../models/highway.js";
export declare const IMPORT_FORMAT_PROVIDER_TYPE = "import:format";
export interface ImportFormatConfig {
    readonly sloppakCacheDir: string;
    readonly audioCacheDir: string;
    readonly rscliPath?: string;
}
export interface IImportFormatProvider {
    readonly name: string;
    canHandle(filePath: string): boolean;
    extractMeta(filePath: string, config: ImportFormatConfig): Record<string, unknown>;
    extractCoverArt(filePath: string, config: ImportFormatConfig): Buffer | null;
    extractAudio(filePath: string, trackId: string, config: ImportFormatConfig): Promise<string | null>;
    loadHighway(filePath: string, arrangements: ArrangementData[], arrangementIndex: number, config: ImportFormatConfig): HighwayResponse;
    resolveStaticFile?(filename: string, relPath: string, config: ImportFormatConfig): string | null;
}
//# sourceMappingURL=IImportFormatProvider.d.ts.map