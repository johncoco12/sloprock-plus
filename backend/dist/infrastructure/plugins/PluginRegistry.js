import fs from "node:fs";
import path from "node:path";
import { NotFoundError } from "../../domain/errors.js";
export class PluginRegistry {
    plugins = [];
    discover(builtinDir, userDir) {
        const bundled = this.scanDir(builtinDir, true);
        const user = userDir ? this.scanDir(userDir, false) : [];
        const userIds = new Set(user.map((p) => p.id));
        this.plugins = [...user, ...bundled.filter((p) => !userIds.has(p.id))];
    }
    getAll() {
        return this.plugins;
    }
    getById(id) {
        const plugin = this.plugins.find((p) => p.id === id);
        if (!plugin)
            throw new NotFoundError(`Plugin "${id}"`);
        return plugin;
    }
    resolveFile(pluginId, filename) {
        const plugin = this.getById(pluginId);
        const safe = filename.replace(/\.\./g, "").replace(/^\//, "");
        const full = path.join(plugin.dir, safe);
        if (!full.startsWith(plugin.dir))
            throw new NotFoundError(`File in plugin "${pluginId}"`);
        if (!fs.existsSync(full))
            throw new NotFoundError(`"${filename}" in plugin "${pluginId}"`);
        return full;
    }
    scanDir(dir, bundled) {
        if (!fs.existsSync(dir))
            return [];
        const results = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory())
                continue;
            const pluginDir = path.join(dir, entry.name);
            const manifest = this.readManifest(pluginDir);
            if (!manifest)
                continue;
            results.push({
                id: manifest.id,
                name: manifest.name,
                version: manifest.version,
                bundled: bundled || !!manifest.bundled,
                dir: pluginDir,
                manifest,
                capabilities: {
                    hasScreen: !!manifest.screen && fs.existsSync(path.join(pluginDir, manifest.screen)),
                    hasScript: !!manifest.script && fs.existsSync(path.join(pluginDir, manifest.script)),
                    hasSettings: !!manifest.settings?.html && fs.existsSync(path.join(pluginDir, manifest.settings.html)),
                    hasTour: this.hasTourFile(manifest, pluginDir),
                    hasComponent: !!manifest.component && fs.existsSync(path.join(pluginDir, manifest.component)),
                },
            });
        }
        return results;
    }
    readManifest(pluginDir) {
        const manifestPath = path.join(pluginDir, "plugin.json");
        if (!fs.existsSync(manifestPath))
            return null;
        try {
            return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        }
        catch {
            return null;
        }
    }
    hasTourFile(manifest, pluginDir) {
        const file = typeof manifest.tour === "string" ? manifest.tour : manifest.tour?.file;
        return !!file && fs.existsSync(path.join(pluginDir, file));
    }
}
//# sourceMappingURL=PluginRegistry.js.map