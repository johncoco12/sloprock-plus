export class ProviderRegistry {
    providers = new Map();
    active = new Map();
    // Nested map: type -> name -> pluginId (avoids ambiguous string encoding)
    ownership = new Map();
    register(type, name, provider, pluginId) {
        if (!this.providers.has(type)) {
            this.providers.set(type, new Map());
        }
        this.providers.get(type).set(name, provider);
        if (!this.active.has(type)) {
            this.active.set(type, name);
        }
        // Always update ownership when pluginId is provided; clear it when re-registered without one
        const typeOwnership = this.ownership.get(type) ?? new Map();
        if (pluginId) {
            typeOwnership.set(name, pluginId);
        }
        else {
            typeOwnership.delete(name);
        }
        this.ownership.set(type, typeOwnership);
    }
    get(type) {
        const name = this.active.get(type);
        if (!name)
            return null;
        return this.providers.get(type)?.get(name) ?? null;
    }
    getByName(type, name) {
        return this.providers.get(type)?.get(name) ?? null;
    }
    setActive(type, name) {
        if (!this.providers.get(type)?.has(name)) {
            throw new Error(`Provider "${name}" not registered for type "${type}"`);
        }
        this.active.set(type, name);
    }
    list(type) {
        const map = this.providers.get(type);
        if (!map)
            return [];
        const activeName = this.active.get(type);
        return [...map.keys()].map((name) => ({ name, active: name === activeName }));
    }
    getAll(type) {
        const map = this.providers.get(type);
        if (!map)
            return [];
        return [...map.values()];
    }
    listTypes() {
        return [...this.providers.keys()];
    }
    unregisterAll(pluginId) {
        for (const [type, nameMap] of this.ownership.entries()) {
            for (const [name, owner] of nameMap.entries()) {
                if (owner !== pluginId)
                    continue;
                this.providers.get(type)?.delete(name);
                nameMap.delete(name);
                if (this.active.get(type) === name) {
                    const remaining = [...(this.providers.get(type)?.keys() ?? [])];
                    if (remaining.length > 0) {
                        this.active.set(type, remaining[0]);
                    }
                    else {
                        this.active.delete(type);
                    }
                }
            }
        }
    }
}
//# sourceMappingURL=ProviderRegistry.js.map