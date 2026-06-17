export interface MetadataLookup {
    readonly title: string;
    readonly artist: string;
    readonly album?: string;
}
export interface EnrichedMetadata {
    readonly title?: string;
    readonly artist?: string;
    readonly album?: string;
    readonly year?: string;
    readonly genre?: string;
    readonly albumArt?: string;
    readonly bpm?: number;
    readonly source: string;
    readonly sourceId?: string;
}
export interface IMetadataProvider {
    readonly name: string;
    enrich(lookup: MetadataLookup): Promise<EnrichedMetadata | null>;
}
//# sourceMappingURL=IMetadataProvider.d.ts.map