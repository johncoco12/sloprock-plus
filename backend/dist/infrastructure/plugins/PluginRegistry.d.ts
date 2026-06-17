import type { LoadedPlugin } from "../../domain/models/plugin.js";
export declare class PluginRegistry {
    private plugins;
    discover(builtinDir: string, userDir?: string): void;
    getAll(): LoadedPlugin[];
    getById(id: string): LoadedPlugin;
    resolveFile(pluginId: string, filename: string): string;
    private scanDir;
    private readManifest;
    private hasTourFile;
}
//# sourceMappingURL=PluginRegistry.d.ts.map