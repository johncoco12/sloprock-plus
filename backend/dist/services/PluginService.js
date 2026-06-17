import { ALL_PERMISSIONS } from "../domain/models/permission.js";
export class PluginService {
    registry;
    lifecycle;
    providers;
    permissionReg;
    dbFactory;
    constructor(registry, lifecycle, providers, permissionReg, dbFactory) {
        this.registry = registry;
        this.lifecycle = lifecycle;
        this.providers = providers;
        this.permissionReg = permissionReg;
        this.dbFactory = dbFactory;
    }
    getAll() {
        const statuses = new Map(this.lifecycle.getStatus().map((s) => [s.id, s]));
        return this.registry.getAll().map((p) => this._shape(p, statuses.get(p.id)));
    }
    getById(id) {
        const plugin = this.registry.getById(id);
        const status = this.lifecycle.getStatus().find((s) => s.id === id);
        return this._shape(plugin, status);
    }
    _shape(p, status) {
        return {
            id: p.id,
            name: p.name,
            version: p.version,
            bundled: p.bundled,
            type: p.manifest.type,
            nav: p.manifest.nav,
            has_settings: p.capabilities.hasSettings,
            has_script: p.capabilities.hasScript,
            script: p.manifest.script,
            component: p.manifest.component,
            capabilities: p.capabilities,
            manifest: p.manifest,
            state: status?.state ?? "discovered",
            error: status?.error,
        };
    }
    listProviders() {
        return this.providers.listTypes().map((type) => ({
            type,
            providers: this.providers.list(type),
        }));
    }
    setActiveProvider(type, name) {
        this.providers.setActive(type, name);
    }
    listAvailablePermissions() {
        const core = ALL_PERMISSIONS.map((name) => ({
            name,
            description: `Core permission: ${name}`,
        }));
        const plugin = this.permissionReg.list().map((d) => ({
            name: d.name,
            description: d.description,
            pluginId: d.pluginId,
        }));
        return [...core, ...plugin];
    }
    async enablePlugin(id) {
        await this.lifecycle.enable(id);
    }
    async disablePlugin(id) {
        await this.lifecycle.disable(id);
    }
    async purgePluginData(pluginId) {
        await this.dbFactory.purgePlugin(pluginId);
    }
}
//# sourceMappingURL=PluginService.js.map