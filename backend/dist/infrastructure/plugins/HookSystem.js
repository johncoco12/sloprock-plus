export class HookSystem {
    hooks = new Map();
    register(event, pluginId, handler, opts) {
        const entry = {
            pluginId,
            handler,
            phase: opts?.phase ?? "after",
            priority: opts?.priority ?? 100,
        };
        const list = this.hooks.get(event) ?? [];
        list.push(entry);
        list.sort((a, b) => a.priority - b.priority);
        this.hooks.set(event, list);
    }
    unregister(event, pluginId, handler) {
        const list = this.hooks.get(event);
        if (!list)
            return;
        this.hooks.set(event, list.filter((e) => !(e.pluginId === pluginId && e.handler === handler)));
    }
    unregisterAll(pluginId) {
        for (const [event, entries] of this.hooks.entries()) {
            this.hooks.set(event, entries.filter((e) => e.pluginId !== pluginId));
        }
    }
    async emit(event, data = {}) {
        const payload = {
            event,
            data: { ...data },
            timestamp: Date.now(),
            aborted: false,
            abort() {
                this.aborted = true;
            },
        };
        const entries = this.hooks.get(event) ?? [];
        const before = entries.filter((e) => e.phase === "before");
        const after = entries.filter((e) => e.phase === "after");
        for (const entry of [...before, ...after]) {
            if (payload.aborted)
                break;
            try {
                const result = await entry.handler(payload);
                if (result?.data) {
                    Object.assign(payload.data, result.data);
                }
            }
            catch (err) {
                console.error(`[hooks] ${event} handler from plugin "${entry.pluginId}" threw:`, err);
            }
        }
        return payload;
    }
}
//# sourceMappingURL=HookSystem.js.map