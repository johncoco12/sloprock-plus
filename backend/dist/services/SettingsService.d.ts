import type { Settings } from "../domain/models/library.js";
import type { Config } from "../config.js";
export declare class SettingsService {
    private readonly config;
    constructor(config: Config);
    load(): Settings;
    save(patch: Partial<Settings>): Settings;
    exportBundle(): Record<string, unknown>;
    importBundle(bundle: Record<string, unknown>): {
        ok: boolean;
        warnings?: string[];
    };
    asApiResponse(): Record<string, unknown>;
}
//# sourceMappingURL=SettingsService.d.ts.map