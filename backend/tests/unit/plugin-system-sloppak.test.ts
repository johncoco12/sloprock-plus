/**
 * Comprehensive tests for the plugin system using the sloppak format as the
 * concrete example throughout.
 */
import fs from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SloppakFormatProvider } from "../../../plugins/format_sloppak/src/SloppakFormatProvider.js";
import { ProviderRegistry } from "../../src/infrastructure/plugins/ProviderRegistry.js";
import { HookSystem } from "../../src/infrastructure/plugins/HookSystem.js";
import { PluginLifecycle } from "../../src/infrastructure/plugins/PluginLifecycle.js";
import { PermissionRegistry } from "../../src/infrastructure/plugins/PermissionRegistry.js";
import { ImportService } from "../../src/services/ImportService.js";
import { IMPORT_FORMAT_PROVIDER_TYPE } from "../../src/domain/interfaces/providers/IImportFormatProvider.js";
import type { IImportFormatProvider } from "../../src/domain/interfaces/providers/IImportFormatProvider.js";
import type { PluginRegistry } from "../../src/infrastructure/plugins/PluginRegistry.js";
import type { PluginDbFactory } from "../../src/infrastructure/plugins/PluginDb.js";
import type { RouteRegistrar } from "../../src/infrastructure/plugins/RouteRegistrar.js";
import type { LoadedPlugin } from "../../src/domain/models/plugin.js";
import type { Config } from "../../src/config.js";
import type { FastifyBaseLogger } from "fastify";

// Prevent PluginLifecycle from hitting the real filesystem for disabled-plugins.json
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
  readFile: vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const fakeConfig: Config = {
  configDir: "/tmp/config",
  pluginsBuiltinDir: "/tmp/plugins",
  pluginsUserDir: "/tmp/user-plugins",
  dlcDir: "/tmp/dlc",
  sloppakCacheDir: "/tmp/sloppak-cache",
  audioCacheDir: "/tmp/audio-cache",
  version: "0.0.0-test",
} as unknown as Config;

const fakeLogger: FastifyBaseLogger = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  debug: vi.fn(), trace: vi.fn(), fatal: vi.fn(),
  child: function() { return this; },
} as unknown as FastifyBaseLogger;

function makePlugin(id: string, entry?: string): LoadedPlugin {
  return {
    id,
    name: `Plugin ${id}`,
    version: "1.0.0",
    bundled: true,
    dir: `/plugins/${id}`,
    manifest: {
      id,
      name: `Plugin ${id}`,
      ...(entry ? { server: entry } : {}),
    },
    capabilities: {
      hasScreen: false, hasScript: false,
      hasSettings: false, hasTour: false, hasComponent: false,
    },
  };
}

function makePluginRegistry(plugins: LoadedPlugin[]): PluginRegistry {
  return {
    discover: () => {},
    getAll: () => plugins,
    getById: (id) => {
      const p = plugins.find((x) => x.id === id);
      if (!p) throw new Error(`Plugin "${id}" not found`);
      return p;
    },
    resolveFile: () => "/tmp/file",
  } as unknown as PluginRegistry;
}

function makeDbFactory(): PluginDbFactory {
  return {
    forPlugin: () => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    }),
    purgePlugin: vi.fn().mockResolvedValue(undefined),
  } as unknown as PluginDbFactory;
}

function makeRouteRegistrar(): RouteRegistrar {
  return {
    forPlugin: () => ({
      register: vi.fn(),
      ws: vi.fn(),
    }),
  } as unknown as RouteRegistrar;
}

function buildLifecycle(plugins: LoadedPlugin[]) {
  const hooks       = new HookSystem();
  const providers   = new ProviderRegistry();
  const permissions = new PermissionRegistry();
  const registry    = makePluginRegistry(plugins);
  const dbFactory   = makeDbFactory();
  const routes      = makeRouteRegistrar();
  const lifecycle   = new PluginLifecycle(
    registry, hooks, providers, permissions, dbFactory, routes, fakeConfig, fakeLogger,
  );
  return { lifecycle, hooks, providers, dbFactory, routes };
}


describe("SloppakFormatProvider.canHandle", () => {
  const provider = new SloppakFormatProvider();

  it("accepts .sloppak extension", () => {
    expect(provider.canHandle("song.sloppak")).toBe(true);
  });

  it("accepts .sloppak inside a path", () => {
    expect(provider.canHandle("/home/user/music/my-song.sloppak")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(provider.canHandle("SONG.SLOPPAK")).toBe(true);
    expect(provider.canHandle("Song.Sloppak")).toBe(true);
  });

  it("rejects any other extension", () => {
    expect(provider.canHandle("song.mp3")).toBe(false);
    expect(provider.canHandle("song.zip")).toBe(false);
    expect(provider.canHandle("song.json")).toBe(false);
  });

  it("rejects a path with no extension", () => {
    expect(provider.canHandle("/dlc/mysong")).toBe(false);
  });

  it("rejects a path that contains .sloppak as a directory component", () => {
    expect(provider.canHandle("/dlc/song.sloppak/readme.txt")).toBe(false);
  });
});


describe("SloppakFormatProvider.resolveStaticFile", () => {
  const provider = new SloppakFormatProvider();
  const config = { sloppakCacheDir: "/cache", audioCacheDir: "/audio" };

  beforeEach(() => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a resolved path for a valid relative file", () => {
    const result = provider.resolveStaticFile("song.sloppak", "stems/guitar.ogg", config);
    expect(result).toContain("guitar.ogg");
    expect(result).toContain("song");
  });

  it("returns null for .. traversal in relPath", () => {
    expect(provider.resolveStaticFile("song.sloppak", "../etc/passwd", config)).toBeNull();
  });

  it("returns null for absolute relPath starting with /", () => {
    expect(provider.resolveStaticFile("song.sloppak", "/etc/passwd", config)).toBeNull();
  });

  it("returns null for relPath containing backslash", () => {
    expect(provider.resolveStaticFile("song.sloppak", "stems\\guitar.ogg", config)).toBeNull();
  });

  it("returns null when the resolved file does not exist", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    expect(provider.resolveStaticFile("song.sloppak", "stems/guitar.ogg", config)).toBeNull();
  });

  it("stays within the sloppak cache directory (no escaping)", () => {
    const result = provider.resolveStaticFile("song.sloppak", "arrangements/lead.json", config);
    if (result !== null) {
      expect(result.startsWith("/cache/song")).toBe(true);
    }
  });
});


describe("ProviderRegistry: format provider registration", () => {
  it("getAll returns empty array before any provider is registered", () => {
    const registry = new ProviderRegistry();
    expect(registry.getAll<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE)).toHaveLength(0);
  });

  it("getAll returns the registered sloppak provider", () => {
    const registry = new ProviderRegistry();
    const provider = new SloppakFormatProvider();
    registry.register(IMPORT_FORMAT_PROVIDER_TYPE, provider.name, provider, "format_sloppak");
    const all = registry.getAll<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("sloppak");
  });

  it("canHandle is delegated correctly through the retrieved provider", () => {
    const registry = new ProviderRegistry();
    const provider = new SloppakFormatProvider();
    registry.register(IMPORT_FORMAT_PROVIDER_TYPE, provider.name, provider, "format_sloppak");
    const [retrieved] = registry.getAll<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE);
    expect(retrieved.canHandle("song.sloppak")).toBe(true);
    expect(retrieved.canHandle("song.mp3")).toBe(false);
  });

  it("getByName returns the provider by its name", () => {
    const registry = new ProviderRegistry();
    const provider = new SloppakFormatProvider();
    registry.register(IMPORT_FORMAT_PROVIDER_TYPE, provider.name, provider, "format_sloppak");
    const found = registry.getByName<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE, "sloppak");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("sloppak");
  });

  it("unregisterAll removes the provider when called with the owning plugin id", () => {
    const registry = new ProviderRegistry();
    const provider = new SloppakFormatProvider();
    registry.register(IMPORT_FORMAT_PROVIDER_TYPE, provider.name, provider, "format_sloppak");
    registry.unregisterAll("format_sloppak");
    expect(registry.getAll<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE)).toHaveLength(0);
  });
});


describe("HookSystem: import lifecycle hooks", () => {
  it("import:queued fires with filename and format", async () => {
    const hooks = new HookSystem();
    const handler = vi.fn();
    hooks.register("import:queued", "test-plugin", handler);

    await hooks.emit("import:queued", { jobId: "j1", filename: "song.sloppak", format: "sloppak", profileId: 1 });

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0];
    expect(payload.data.filename).toBe("song.sloppak");
    expect(payload.data.format).toBe("sloppak");
  });

  it("import:before abort flag prevents the import", async () => {
    const hooks = new HookSystem();
    hooks.register("import:before", "gate-plugin", async (payload) => {
      payload.abort();
    }, { phase: "before" });

    const payload = await hooks.emit("import:before", { jobId: "j2", filename: "song.sloppak", format: "sloppak", filePath: "/tmp/dlc/song.sloppak" });
    expect((payload as { aborted: boolean }).aborted).toBe(true);
  });

  it("import:complete fires with track info", async () => {
    const hooks = new HookSystem();
    const handler = vi.fn();
    hooks.register("import:complete", "test-plugin", handler);

    await hooks.emit("import:complete", { jobId: "j3", trackId: "track_j3", title: "My Song", artist: "Artist", format: "sloppak" });

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0];
    expect(payload.data.format).toBe("sloppak");
    expect(payload.data.trackId).toBe("track_j3");
  });

  it("import:failed fires with error details", async () => {
    const hooks = new HookSystem();
    const handler = vi.fn();
    hooks.register("import:failed", "test-plugin", handler);

    await hooks.emit("import:failed", { jobId: "j4", filename: "song.sloppak", format: "sloppak", error: "File not found" });

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0];
    expect(payload.data.error).toBe("File not found");
    expect(payload.data.format).toBe("sloppak");
  });

  it("hooks fire in ascending priority order", async () => {
    const hooks = new HookSystem();
    const calls: number[] = [];
    hooks.register("import:queued", "p1", async () => { calls.push(1); }, { priority: 200 });
    hooks.register("import:queued", "p2", async () => { calls.push(2); }, { priority: 50 });
    hooks.register("import:queued", "p3", async () => { calls.push(3); }, { priority: 100 });

    await hooks.emit("import:queued", { filename: "song.sloppak", format: "sloppak" });

    expect(calls).toEqual([2, 3, 1]);
  });

  it("an aborted import:before hook skips remaining handlers", async () => {
    const hooks = new HookSystem();
    const secondHandler = vi.fn();
    hooks.register("import:before", "abort-plugin", async (p) => { p.abort(); }, { phase: "before", priority: 1 });
    hooks.register("import:before", "second-plugin", secondHandler, { phase: "before", priority: 2 });

    await hooks.emit("import:before", { filename: "song.sloppak", format: "sloppak" });

    expect(secondHandler).not.toHaveBeenCalled();
  });
});


describe("PluginLifecycle: sloppak format provider via ctx.import.registerFormat", () => {
  it("provider is available in registry after plugin setup", async () => {
    const { lifecycle, providers } = buildLifecycle([makePlugin("format_sloppak", "index.js")]);

    vi.spyOn(lifecycle as any, "importModule").mockResolvedValue({
      setup: async (ctx: { import: { registerFormat: (p: IImportFormatProvider) => void } }) => {
        ctx.import.registerFormat(new SloppakFormatProvider());
      },
    });

    await lifecycle.start();

    const all = providers.getAll<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("sloppak");
  });

  it("provider handles .sloppak files after registration", async () => {
    const { lifecycle, providers } = buildLifecycle([makePlugin("format_sloppak", "index.js")]);

    vi.spyOn(lifecycle as any, "importModule").mockResolvedValue({
      setup: async (ctx: { import: { registerFormat: (p: IImportFormatProvider) => void } }) => {
        ctx.import.registerFormat(new SloppakFormatProvider());
      },
    });

    await lifecycle.start();

    const [provider] = providers.getAll<IImportFormatProvider>(IMPORT_FORMAT_PROVIDER_TYPE);
    expect(provider.canHandle("/dlc/my-song.sloppak")).toBe(true);
    expect(provider.canHandle("/dlc/my-song.mp3")).toBe(false);
  });

  it("provider is unregistered from registry after teardown", async () => {
    const { lifecycle, providers } = buildLifecycle([makePlugin("format_sloppak", "index.js")]);

    vi.spyOn(lifecycle as any, "importModule").mockResolvedValue({
      setup: async (ctx: { import: { registerFormat: (p: IImportFormatProvider) => void } }) => {
        ctx.import.registerFormat(new SloppakFormatProvider());
      },
    });

    await lifecycle.start();
    expect(providers.getAll(IMPORT_FORMAT_PROVIDER_TYPE)).toHaveLength(1);

    await lifecycle.disable("format_sloppak");
    expect(providers.getAll(IMPORT_FORMAT_PROVIDER_TYPE)).toHaveLength(0);
  });
});


describe("Plugin ctx.db: per-plugin key-value store", () => {
  it("set and get round-trip returns the stored value", async () => {
    const { lifecycle, dbFactory } = buildLifecycle([makePlugin("format_sloppak", "index.js")]);

    let capturedDb: { get: (k: string) => Promise<unknown>; set: (k: string, v: unknown) => Promise<void> } | null = null;
    const dbForPlugin = {
      get: vi.fn().mockImplementation(async (key: string) => key === "quality" ? "high" : null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(dbFactory, "forPlugin").mockReturnValue(dbForPlugin as any);

    vi.spyOn(lifecycle as any, "importModule").mockResolvedValue({
      setup: async (ctx: { db: typeof dbForPlugin }) => {
        capturedDb = ctx.db;
        await ctx.db.set("quality", "high");
      },
    });

    await lifecycle.start();

    expect(dbForPlugin.set).toHaveBeenCalledWith("quality", "high");
    expect(capturedDb).not.toBeNull();
    const value = await capturedDb!.get("quality");
    expect(value).toBe("high");
  });

  it("returns null for a key that was never set", async () => {
    const { lifecycle, dbFactory } = buildLifecycle([makePlugin("format_sloppak", "index.js")]);

    const dbForPlugin = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(dbFactory, "forPlugin").mockReturnValue(dbForPlugin as any);

    let capturedDb: typeof dbForPlugin | null = null;
    vi.spyOn(lifecycle as any, "importModule").mockResolvedValue({
      setup: async (ctx: { db: typeof dbForPlugin }) => { capturedDb = ctx.db; },
    });

    await lifecycle.start();
    const value = await capturedDb!.get("missing-key");
    expect(value).toBeNull();
  });
});


describe("Plugin ctx.routes.register", () => {
  it("register is called during setup with the expected arguments", async () => {
    const { lifecycle, routes } = buildLifecycle([makePlugin("format_sloppak", "index.js")]);

    const routeStub = { register: vi.fn(), ws: vi.fn() };
    vi.spyOn(routes, "forPlugin").mockReturnValue(routeStub as any);

    vi.spyOn(lifecycle as any, "importModule").mockResolvedValue({
      setup: async (ctx: { routes: typeof routeStub }) => {
        ctx.routes.register("GET", "/api/plugins/format_sloppak/settings", async () => ({}));
      },
    });

    await lifecycle.start();

    expect(routeStub.register).toHaveBeenCalledOnce();
    expect(routeStub.register).toHaveBeenCalledWith(
      "GET",
      "/api/plugins/format_sloppak/settings",
      expect.any(Function),
    );
  });

  it("the registered handler can be invoked and returns the expected shape", async () => {
    const { lifecycle, routes } = buildLifecycle([makePlugin("format_sloppak", "index.js")]);

    let capturedHandler: (() => Promise<unknown>) | null = null;
    const routeStub = {
      register: vi.fn().mockImplementation((_method: string, _path: string, handler: () => Promise<unknown>) => {
        capturedHandler = handler;
      }),
      ws: vi.fn(),
    };
    vi.spyOn(routes, "forPlugin").mockReturnValue(routeStub as any);

    vi.spyOn(lifecycle as any, "importModule").mockResolvedValue({
      setup: async (ctx: { routes: typeof routeStub }) => {
        ctx.routes.register("GET", "/api/plugins/format_sloppak/settings", async () => ({
          format: "sloppak",
          enabled: true,
        }));
      },
    });

    await lifecycle.start();

    expect(capturedHandler).not.toBeNull();
    const result = await capturedHandler!();
    expect(result).toMatchObject({ format: "sloppak", enabled: true });
  });
});


describe("ImportService.enqueue: sloppak format auto-detection", () => {
  function buildImportService(providerRegistry: ProviderRegistry) {
    const hooks = new HookSystem();
    const noop = async () => { throw new Error("not implemented in stub"); };
    const songs = { upsert: noop } as any;
    const tracks = { create: noop, findById: noop } as any;
    const trackData = { findByOriginalFilename: noop, create: noop } as any;
    const stems = { create: noop } as any;
    const stemData = { create: noop } as any;
    const storage = { store: noop, storeFromPath: noop } as any;

    const service = new ImportService(
      songs, tracks, trackData, stems, stemData, storage,
      fakeConfig, providerRegistry, hooks,
    );
    // Prevent processJob from running — we only test enqueue()
    vi.spyOn(service as any, "processJob").mockResolvedValue(undefined);
    return { service, hooks };
  }

  it("returns null when no provider handles the file extension", () => {
    const providers = new ProviderRegistry();
    const { service } = buildImportService(providers);
    const job = service.enqueue("song.mp3", 1);
    expect(job).toBeNull();
  });

  it("returns an ImportJob with format 'sloppak' for a .sloppak file", () => {
    const providers = new ProviderRegistry();
    providers.register(IMPORT_FORMAT_PROVIDER_TYPE, "sloppak", new SloppakFormatProvider(), "format_sloppak");

    const { service } = buildImportService(providers);
    const job = service.enqueue("song.sloppak", 1);

    expect(job).not.toBeNull();
    expect(job!.format).toBe("sloppak");
    expect(job!.filename).toBe("song.sloppak");
    expect(job!.profileId).toBe(1);
    expect(job!.status).toBe("queued");
  });

  it("assigns a unique id to each enqueued job", () => {
    const providers = new ProviderRegistry();
    providers.register(IMPORT_FORMAT_PROVIDER_TYPE, "sloppak", new SloppakFormatProvider(), "format_sloppak");

    const { service } = buildImportService(providers);
    const job1 = service.enqueue("song-a.sloppak", 1);
    const job2 = service.enqueue("song-b.sloppak", 1);

    expect(job1!.id).not.toBe(job2!.id);
  });

  it("emits import:queued with the sloppak format", () => {
    const providers = new ProviderRegistry();
    providers.register(IMPORT_FORMAT_PROVIDER_TYPE, "sloppak", new SloppakFormatProvider(), "format_sloppak");

    const hooks = new HookSystem();
    const emitSpy = vi.spyOn(hooks, "emit");

    const noop = async () => { throw new Error("not implemented"); };
    const service = new ImportService(
      { upsert: noop } as any,
      { create: noop } as any,
      { findByOriginalFilename: noop, create: noop } as any,
      { create: noop } as any,
      { create: noop } as any,
      { store: noop, storeFromPath: noop } as any,
      fakeConfig, providers, hooks,
    );
    vi.spyOn(service as any, "processJob").mockResolvedValue(undefined);

    service.enqueue("song.sloppak", 42);

    expect(emitSpy).toHaveBeenCalledWith(
      "import:queued",
      expect.objectContaining({ filename: "song.sloppak", format: "sloppak", profileId: 42 }),
    );
  });

  it("getStatus returns the queued job after enqueue", () => {
    const providers = new ProviderRegistry();
    providers.register(IMPORT_FORMAT_PROVIDER_TYPE, "sloppak", new SloppakFormatProvider(), "format_sloppak");

    const { service } = buildImportService(providers);
    const job = service.enqueue("song.sloppak", 1);
    const status = service.getStatus(job!.id);

    expect(status).not.toBeNull();
    expect(status!.format).toBe("sloppak");
  });

  it("getAllJobs includes the enqueued sloppak job", () => {
    const providers = new ProviderRegistry();
    providers.register(IMPORT_FORMAT_PROVIDER_TYPE, "sloppak", new SloppakFormatProvider(), "format_sloppak");

    const { service } = buildImportService(providers);
    service.enqueue("song.sloppak", 1);
    const all = service.getAllJobs();

    expect(all.length).toBeGreaterThan(0);
    expect(all.some((j) => j.format === "sloppak")).toBe(true);
  });
});
