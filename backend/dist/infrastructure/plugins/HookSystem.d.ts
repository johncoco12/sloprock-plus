import type { HookHandler, HookOptions, HookPayload } from "../../domain/interfaces/plugins/PluginContext.js";
export type HookEvent = "song:load" | "song:play" | "song:pause" | "song:stop" | "song:end" | "note:hit" | "note:miss" | "library:scan:start" | "library:scan:complete" | "library:song:added" | "library:song:removed" | "import:queued" | "import:before" | "import:complete" | "import:failed" | "server:startup" | "server:shutdown" | "plugin:loaded" | "plugin:errored" | (string & {});
export declare class HookSystem {
    private readonly hooks;
    register(event: string, pluginId: string, handler: HookHandler, opts?: HookOptions): void;
    unregister(event: string, pluginId: string, handler: HookHandler): void;
    unregisterAll(pluginId: string): void;
    emit(event: string, data?: Record<string, unknown>): Promise<HookPayload>;
}
//# sourceMappingURL=HookSystem.d.ts.map