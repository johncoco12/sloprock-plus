export class PermissionRegistry {
    definitions = new Map();
    define(pluginId, name, description) {
        if (this.definitions.has(name)) {
            const existing = this.definitions.get(name);
            if (existing.pluginId !== pluginId) {
                throw new Error(`Permission "${name}" is already defined by plugin "${existing.pluginId}"`);
            }
            return;
        }
        this.definitions.set(name, { name, description, pluginId });
    }
    list() {
        return [...this.definitions.values()];
    }
    listForPlugin(pluginId) {
        return [...this.definitions.values()].filter((d) => d.pluginId === pluginId);
    }
    has(name) {
        return this.definitions.has(name);
    }
    unregisterAll(pluginId) {
        for (const [name, def] of this.definitions.entries()) {
            if (def.pluginId === pluginId) {
                this.definitions.delete(name);
            }
        }
    }
}
//# sourceMappingURL=PermissionRegistry.js.map