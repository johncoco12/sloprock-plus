import path from "node:path";
import fs from "node:fs/promises";
import { IMPORT_FORMAT_PROVIDER_TYPE } from "../../domain/interfaces/providers/IImportFormatProvider.js";
export class PluginLifecycle {
    registry;
    hooks;
    providers;
    permissions;
    dbFactory;
    routeRegistrar;
    config;
    logger;
    state = new Map();
    modules = new Map();
    errors = new Map();
    disabled = new Set();
    loadOrder = [];
    disabledPath;
    constructor(registry, hooks, providers, permissions, dbFactory, routeRegistrar, config, logger) {
        this.registry = registry;
        this.hooks = hooks;
        this.providers = providers;
        this.permissions = permissions;
        this.dbFactory = dbFactory;
        this.routeRegistrar = routeRegistrar;
        this.config = config;
        this.logger = logger;
        this.disabledPath = path.join(config.configDir, "disabled-plugins.json");
    }
    async start() {
        await this.loadDisabledSet();
        const plugins = this.registry.getAll();
        for (const p of plugins) {
            this.state.set(p.id, this.disabled.has(p.id) ? "disabled" : "discovered");
        }
        this.loadOrder = this.topoSort(plugins);
        for (const id of this.loadOrder) {
            if (this.disabled.has(id))
                continue;
            await this.loadOne(id);
        }
        await this.hooks.emit("server:startup");
    }
    async enable(id) {
        this.registry.getById(id); // throws if unknown
        if (!this.disabled.has(id))
            return;
        this.disabled.delete(id);
        await this.saveDisabledSet();
        // Routes can't be added to a running Fastify instance — caller must restart
    }
    async disable(id) {
        this.registry.getById(id); // throws if unknown
        if (this.disabled.has(id))
            return;
        await this.teardownOne(id);
        this.disabled.add(id);
        this.state.set(id, "disabled");
        await this.saveDisabledSet();
    }
    isDisabled(id) {
        return this.disabled.has(id);
    }
    async loadDisabledSet() {
        try {
            const raw = await fs.readFile(this.disabledPath, "utf-8");
            const ids = JSON.parse(raw);
            for (const id of ids)
                this.disabled.add(id);
        }
        catch { /* file doesn't exist yet — all enabled */ }
    }
    async saveDisabledSet() {
        try {
            await fs.writeFile(this.disabledPath, JSON.stringify([...this.disabled]), "utf-8");
        }
        catch (err) {
            this.logger.warn({ err }, "Failed to persist disabled-plugins.json");
        }
    }
    async shutdown() {
        await this.hooks.emit("server:shutdown");
        for (const id of [...this.loadOrder].reverse()) {
            await this.teardownOne(id);
        }
    }
    getStatus() {
        return this.registry.getAll().map((p) => ({
            id: p.id,
            name: p.name,
            version: p.version,
            state: this.state.get(p.id) ?? "discovered",
            error: this.errors.get(p.id),
        }));
    }
    async loadOne(id) {
        const plugin = this.registry.getById(id);
        try {
            this.state.set(id, "loading");
            const mod = await this.importModule(plugin);
            if (!mod.setup) {
                this.state.set(id, "active");
                return;
            }
            this.state.set(id, "setting_up");
            const ctx = this.buildContext(plugin);
            await mod.setup(ctx);
            this.modules.set(id, mod);
            this.state.set(id, "active");
            await this.hooks.emit("plugin:loaded", { pluginId: id });
            this.logger.info({ pluginId: id }, "Plugin loaded");
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.state.set(id, "errored");
            this.errors.set(id, msg);
            this.logger.error({ pluginId: id, err }, "Plugin setup failed");
            await this.hooks.emit("plugin:errored", { pluginId: id, error: msg });
        }
    }
    async teardownOne(id) {
        const mod = this.modules.get(id);
        if (!mod || this.state.get(id) !== "active")
            return;
        try {
            this.state.set(id, "tearing_down");
            if (mod.teardown) {
                const plugin = this.registry.getById(id);
                await mod.teardown(this.buildContext(plugin));
            }
        }
        catch (err) {
            this.logger.error({ pluginId: id, err }, "Plugin teardown failed");
        }
        finally {
            this.hooks.unregisterAll(id);
            this.providers.unregisterAll(id);
            this.permissions.unregisterAll(id);
            this.modules.delete(id);
            this.state.set(id, "disabled");
        }
    }
    async importModule(plugin) {
        // `server` is the explicit server-side entry; fall back to `script` for
        // older plugins that used `script` for both browser IIFE and server module.
        const entry = plugin.manifest.server ?? plugin.manifest.script;
        if (!entry)
            return {};
        const entryPath = path.resolve(plugin.dir, entry);
        return (await import(entryPath));
    }
    buildContext(plugin) {
        const pluginId = plugin.id;
        const hooks = this.hooks;
        const providers = this.providers;
        const permissions = this.permissions;
        const db = this.dbFactory.forPlugin(pluginId);
        const routes = this.routeRegistrar.forPlugin(pluginId);
        const logger = this.logger.child({ plugin: pluginId });
        const cfg = this.config;
        return {
            pluginId,
            pluginDir: plugin.dir,
            config: {
                configDir: cfg.configDir,
                pluginsBuiltinDir: cfg.pluginsBuiltinDir,
                pluginsUserDir: cfg.pluginsUserDir,
                version: cfg.version,
                env: process.env.NODE_ENV === "production" ? "production" : "development",
            },
            hooks: {
                on(event, handler, opts) {
                    hooks.register(event, pluginId, handler, opts);
                },
                once(event, handler) {
                    const wrapper = async (payload) => {
                        hooks.unregister(event, pluginId, wrapper);
                        return handler(payload);
                    };
                    hooks.register(event, pluginId, wrapper);
                },
                off(event, handler) {
                    hooks.unregister(event, pluginId, handler);
                },
            },
            routes,
            providers: {
                register(type, name, provider) {
                    providers.register(type, name, provider, pluginId);
                },
                get(type) {
                    return providers.get(type);
                },
                getByName(type, name) {
                    return providers.getByName(type, name);
                },
            },
            permissions: {
                define(name, description) {
                    permissions.define(pluginId, name, description);
                },
            },
            import: {
                registerFormat(provider) {
                    providers.register(IMPORT_FORMAT_PROVIDER_TYPE, provider.name, provider, pluginId);
                },
            },
            db,
            logger: {
                info: (msg, data) => logger.info(data ?? {}, msg),
                warn: (msg, data) => logger.warn(data ?? {}, msg),
                error: (msg, data) => logger.error(data ?? {}, msg),
            },
        };
    }
    topoSort(plugins) {
        const ids = new Set(plugins.map((p) => p.id));
        const inDegree = new Map();
        const edges = new Map();
        for (const p of plugins) {
            inDegree.set(p.id, 0);
            edges.set(p.id, []);
        }
        for (const p of plugins) {
            for (const dep of p.manifest.dependsOn ?? []) {
                if (!ids.has(dep))
                    continue;
                edges.get(dep).push(p.id);
                inDegree.set(p.id, (inDegree.get(p.id) ?? 0) + 1);
            }
        }
        const queue = [...inDegree.entries()]
            .filter(([, d]) => d === 0)
            .map(([id]) => id);
        const result = [];
        while (queue.length) {
            const id = queue.shift();
            result.push(id);
            for (const child of edges.get(id) ?? []) {
                const newDeg = (inDegree.get(child) ?? 1) - 1;
                inDegree.set(child, newDeg);
                if (newDeg === 0)
                    queue.push(child);
            }
        }
        // Append any plugins not reachable via topo sort (e.g. cycles) at the end
        for (const p of plugins) {
            if (!result.includes(p.id))
                result.push(p.id);
        }
        return result;
    }
}
//# sourceMappingURL=PluginLifecycle.js.map