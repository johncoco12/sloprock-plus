export declare class ProviderRegistry {
    private readonly providers;
    private readonly active;
    private readonly ownership;
    register<T>(type: string, name: string, provider: T, pluginId?: string): void;
    get<T>(type: string): T | null;
    getByName<T>(type: string, name: string): T | null;
    setActive(type: string, name: string): void;
    list(type: string): {
        name: string;
        active: boolean;
    }[];
    getAll<T>(type: string): T[];
    listTypes(): string[];
    unregisterAll(pluginId: string): void;
}
//# sourceMappingURL=ProviderRegistry.d.ts.map