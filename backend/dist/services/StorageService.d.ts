import type { IStorageProvider, StoredItem } from "../domain/interfaces/providers/IStorageProvider.js";
import type { IStorageService } from "../domain/interfaces/services/IStorageService.js";
export declare class StorageService implements IStorageService {
    private readonly provider;
    constructor(provider: IStorageProvider);
    store(identifier: string, data: Buffer): Promise<StoredItem>;
    storeFromPath(identifier: string, sourcePath: string): Promise<StoredItem>;
    get(identifier: string): Promise<Buffer | null>;
    delete(identifier: string): Promise<void>;
    exists(identifier: string): Promise<boolean>;
}
//# sourceMappingURL=StorageService.d.ts.map