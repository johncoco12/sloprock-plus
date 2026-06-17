import fs from "node:fs";
import path from "node:path";
const BUNDLE_SCHEMA = "slopsmith.settings.v1";
export class SettingsService {
    config;
    constructor(config) {
        this.config = config;
    }
    load() {
        try {
            return JSON.parse(fs.readFileSync(this.config.settingsPath, "utf8"));
        }
        catch {
            return {};
        }
    }
    save(patch) {
        const current = this.load();
        const updated = { ...current };
        if ("dlcDir" in patch && patch.dlcDir !== undefined)
            updated.dlcDir = patch.dlcDir;
        if ("defaultArrangement" in patch && patch.defaultArrangement !== undefined)
            updated.defaultArrangement = patch.defaultArrangement;
        if ("masterDifficulty" in patch && patch.masterDifficulty !== undefined)
            updated.masterDifficulty = patch.masterDifficulty;
        if ("avOffsetMs" in patch && patch.avOffsetMs !== undefined)
            updated.avOffsetMs = Math.max(-1000, Math.min(1000, patch.avOffsetMs));
        if ("demucsServerUrl" in patch && patch.demucsServerUrl !== undefined)
            updated.demucsServerUrl = patch.demucsServerUrl;
        fs.mkdirSync(path.dirname(this.config.settingsPath), { recursive: true });
        fs.writeFileSync(this.config.settingsPath, JSON.stringify(updated, null, 2));
        return updated;
    }
    exportBundle() {
        const serverConfig = this.load();
        return {
            schema: BUNDLE_SCHEMA,
            exported_at: new Date().toISOString(),
            server_config: serverConfig,
            plugin_server_configs: {},
        };
    }
    importBundle(bundle) {
        if (bundle.schema !== BUNDLE_SCHEMA) {
            return { ok: false };
        }
        const serverConfig = bundle.server_config;
        if (serverConfig && typeof serverConfig === "object") {
            this.save(serverConfig);
        }
        return { ok: true, warnings: [] };
    }
    asApiResponse() {
        const s = this.load();
        return {
            dlc_dir: s.dlcDir ?? this.config.dlcDir ?? "",
            default_arrangement: s.defaultArrangement ?? "Lead",
            master_difficulty: s.masterDifficulty ?? 100,
            av_offset_ms: s.avOffsetMs ?? 0,
            demucs_server_url: s.demucsServerUrl ?? "",
        };
    }
}
//# sourceMappingURL=SettingsService.js.map