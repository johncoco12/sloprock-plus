import type { IStorageProvider, StoredItem } from "../../../domain/interfaces/providers/IStorageProvider.js";
export interface MinIOProviderOptions {
    readonly endPoint: string;
    readonly port?: number;
    readonly accessKey?: string;
    readonly secretKey?: string;
    readonly bucket?: string;
    readonly useSSL?: boolean;
}
export declare class MinIOProvider implements IStorageProvider {
    readonly name = "MinIO";
    private readonly client;
    private readonly bucket;
    private bucketReady;
    constructor(opts: MinIOProviderOptions);
    private ensureBucket;
    store(identifier: string, data: Buffer): Promise<StoredItem>;
    storeFromPath(identifier: string, sourcePath: string): Promise<StoredItem>;
    get(identifier: string): Promise<Buffer | null>;
    delete(identifier: string): Promise<void>;
    exists(identifier: string): Promise<boolean>;
}
//# sourceMappingURL=MinIOProvider.d.ts.map