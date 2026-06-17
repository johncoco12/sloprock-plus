import type { PluginRegistry } from "../infrastructure/plugins/PluginRegistry.js";
import type { PluginLifecycle } from "../infrastructure/plugins/PluginLifecycle.js";
import type { ProviderRegistry } from "../infrastructure/plugins/ProviderRegistry.js";
import type { PermissionRegistry } from "../infrastructure/plugins/PermissionRegistry.js";
import type { PluginDbFactory } from "../infrastructure/plugins/PluginDb.js";
export interface AvailablePermission {
    readonly name: string;
    readonly description: string;
    readonly pluginId?: string;
}
export declare class PluginService {
    private readonly registry;
    private readonly lifecycle;
    private readonly providers;
    private readonly permissionReg;
    private readonly dbFactory;
    constructor(registry: PluginRegistry, lifecycle: PluginLifecycle, providers: ProviderRegistry, permissionReg: PermissionRegistry, dbFactory: PluginDbFactory);
    getAll(): {
        id: string;
        name: string;
        version: string | undefined;
        bundled: boolean;
        type: string | undefined;
        nav: import("../domain/models/plugin.js").PluginNav | undefined;
        has_settings: boolean;
        has_script: boolean;
        script: string | undefined;
        component: string | undefined;
        capabilities: import("../domain/models/plugin.js").PluginCapabilities;
        manifest: import("../domain/models/plugin.js").PluginManifest;
        state: import("../domain/models/plugin.js").PluginState;
        error: string | undefined;
    }[];
    getById(id: string): {
        id: string;
        name: string;
        version: string | undefined;
        bundled: boolean;
        type: string | undefined;
        nav: import("../domain/models/plugin.js").PluginNav | undefined;
        has_settings: boolean;
        has_script: boolean;
        script: string | undefined;
        component: string | undefined;
        capabilities: import("../domain/models/plugin.js").PluginCapabilities;
        manifest: import("../domain/models/plugin.js").PluginManifest;
        state: import("../domain/models/plugin.js").PluginState;
        error: string | undefined;
    };
    private _shape;
    listProviders(): {
        type: string;
        providers: {
            name: string;
            active: boolean;
        }[];
    }[];
    setActiveProvider(type: string, name: string): void;
    listAvailablePermissions(): AvailablePermission[];
    enablePlugin(id: string): Promise<void>;
    disablePlugin(id: string): Promise<void>;
    purgePluginData(pluginId: string): Promise<void>;
}
//# sourceMappingURL=PluginService.d.ts.map