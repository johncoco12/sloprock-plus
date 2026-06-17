export interface PermissionDefinition {
    readonly name: string;
    readonly description: string;
    readonly pluginId: string;
}
export declare class PermissionRegistry {
    private readonly definitions;
    define(pluginId: string, name: string, description: string): void;
    list(): PermissionDefinition[];
    listForPlugin(pluginId: string): PermissionDefinition[];
    has(name: string): boolean;
    unregisterAll(pluginId: string): void;
}
//# sourceMappingURL=PermissionRegistry.d.ts.map