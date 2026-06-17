export class StorageService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    store(identifier, data) {
        return this.provider.store(identifier, data);
    }
    storeFromPath(identifier, sourcePath) {
        return this.provider.storeFromPath(identifier, sourcePath);
    }
    get(identifier) {
        return this.provider.get(identifier);
    }
    delete(identifier) {
        return this.provider.delete(identifier);
    }
    exists(identifier) {
        return this.provider.exists(identifier);
    }
}
//# sourceMappingURL=StorageService.js.map