import type { PluginEventBus } from "./PluginEventBus.js";

export function installLegacyAdapter(bus: PluginEventBus): void {
  const existing = window.sloprock;
  window.sloprock = Object.assign(window.sloprock ?? new EventTarget(), {
    emit(event: string, detail?: unknown) {
      bus.emit(event, detail);
    },
    on(event: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions) {
      const handler = (d: unknown) => {
        if (typeof fn === "function") {
          fn(new CustomEvent(event, { detail: d }));
        } else {
          fn.handleEvent(new CustomEvent(event, { detail: d }));
        }
      };
      if (opts?.once) {
        bus.once(event, handler);
      } else {
        bus.on(event, handler);
      }
    },
    off() {
      // best-effort — legacy callers don't unsubscribe cleanly
    },
  }) as typeof window.sloprock;

  if (existing) {
    for (const key of Object.keys(existing)) {
      if (!(key in window.sloprock!)) {
        (window.sloprock as unknown as Record<string, unknown>)[key] =
          (existing as unknown as Record<string, unknown>)[key];
      }
    }
  }
}
