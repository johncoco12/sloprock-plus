import type { PluginDb } from "../../domain/interfaces/plugins/PluginContext.js";
export declare class PluginDbStore implements PluginDb {
    private readonly pluginId;
    constructor(pluginId: string);
    get<T = unknown>(key: string): Promise<T | null>;
    set<T = unknown>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<{
        key: string;
        value: unknown;
    }[]>;
}
export declare class PluginDbFactory {
    forPlugin(pluginId: string): PluginDb;
    purgePlugin(pluginId: string): Promise<void>;
}
//# sourceMappingURL=PluginDb.d.ts.map