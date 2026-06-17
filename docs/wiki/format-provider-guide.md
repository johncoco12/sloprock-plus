# Format Provider Guide

A **format provider** is a plugin that teaches SlopRock how to read a new song file format. When the scanner encounters a file it doesn't recognise, it asks each registered provider in turn whether it can handle it. The first provider that says yes owns that file for the rest of its lifetime — metadata extraction, cover art, audio, and playback.

---

## How it fits together

```
DLC folder
    │
    │  ScannerService iterates files
    ▼
ImportService.detectFormat(filePath)
    │  calls provider.canHandle(filePath) for each registered provider
    ▼
provider.extractMeta(filePath, config)   → Song row in PostgreSQL
provider.extractCoverArt(filePath, config) → PNG in MinIO
provider.extractAudio(filePath, id, config) → OGG in MinIO
    │
    │  GET /api/tracks/:id/highway
    ▼
provider.loadHighway(filePath, arrangements, index, config) → HighwayResponse
```

---

## The interface

Your provider class must implement `IImportFormatProvider`:

```typescript
import type { IImportFormatProvider, ImportFormatConfig } from
  "../../../backend/src/domain/interfaces/providers/IImportFormatProvider.js";
import type { ArrangementData } from
  "../../../backend/src/domain/models/track.js";
import type { HighwayResponse } from
  "../../../backend/src/domain/models/highway.js";

export class MyFormatProvider implements IImportFormatProvider {
  readonly name = "my-format";   // unique identifier stored in the DB

  canHandle(filePath: string): boolean { ... }

  extractMeta(filePath: string, config: ImportFormatConfig): Record<string, unknown> { ... }

  extractCoverArt(filePath: string, config: ImportFormatConfig): Buffer | null { ... }

  async extractAudio(
    filePath: string,
    trackId: string,
    config: ImportFormatConfig,
  ): Promise<string | null> { ... }

  loadHighway(
    filePath: string,
    arrangements: ArrangementData[],
    arrangementIndex: number,
    config: ImportFormatConfig,
  ): HighwayResponse { ... }

  // Optional — serve internal files (stems, assets) via /api/tracks/:id/static/:relPath
  resolveStaticFile?(
    filename: string,
    relPath: string,
    config: ImportFormatConfig,
  ): string | null { ... }
}
```

---

## Method reference

### `canHandle(filePath)`

Return `true` if this provider owns the file. Called for every file during scanning. Keep it fast — extension check or a header peek at most.

```typescript
canHandle(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".myfmt");
}
```

For directory-based formats, check for a sentinel file:

```typescript
canHandle(filePath: string): boolean {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) return false;
  return fs.existsSync(path.join(filePath, "manifest.yaml"));
}
```

---

### `extractMeta(filePath, config)`

Return a flat object with song metadata. Only the keys listed here are stored; extras are ignored.

```typescript
extractMeta(filePath: string, config: ImportFormatConfig): Record<string, unknown> {
  const meta = readMyFormat(filePath);
  return {
    title:         meta.title ?? "",
    artist:        meta.artist ?? "",
    album:         meta.album ?? "",
    year:          meta.year ?? null,
    duration:      meta.durationSeconds ?? 0,
    tuning:        meta.tuningName ?? "E Standard",    // human-readable
    tuningSortKey: computeTuningSortKey(meta.tuning),  // numeric (see tunings.ts)
    arrangements:  meta.arrangements.map((a, i) => ({
                     index: i, name: a.name, notes: a.noteCount
                   })),
    hasLyrics:     meta.hasLyrics ?? false,
    format:        "my-format",  // must match this.name
    stemCount:     0,
    stemIds:       [],
  };
}
```

`tuningSortKey` is a numeric value used for natural tuning ordering in the library. You can import and call `tuningSortKeyFromOffsets(offsets)` from `backend/src/domain/models/song.js` if you have semitone offsets, or return `0` if tuning order doesn't matter for your format.

---

### `extractCoverArt(filePath, config)`

Return a `Buffer` containing PNG-encoded image data, or `null` if no art is available. The backend converts other image formats automatically — but returning PNG is simplest.

```typescript
extractCoverArt(filePath: string): Buffer | null {
  const artPath = path.join(filePath, "cover.jpg");
  if (!fs.existsSync(artPath)) return null;
  return fs.readFileSync(artPath);
}
```

---

### `extractAudio(filePath, trackId, config)`

Return the **absolute path to an OGG audio file**, or `null` if no audio is available. This method is `async` — you can shell out to FFmpeg or vgmstream-cli here.

The `trackId` string is a stable unique ID for this track — use it to name any intermediate cache files so concurrent extractions don't collide.

```typescript
async extractAudio(
  filePath: string,
  trackId: string,
  config: ImportFormatConfig,
): Promise<string | null> {
  const audioSrc = path.join(filePath, "audio.ogg");
  if (fs.existsSync(audioSrc)) return audioSrc;

  // Convert from another format if needed:
  const wavSrc = path.join(filePath, "audio.wav");
  if (!fs.existsSync(wavSrc)) return null;

  const outPath = path.join(config.audioCacheDir, `${trackId}.ogg`);
  await runFfmpeg(["-i", wavSrc, "-c:a", "libvorbis", outPath]);
  return outPath;
}
```

`config.audioCacheDir` is a writable directory managed by SlopRock — safe to use for converted files.

---

### `loadHighway(filePath, arrangements, arrangementIndex, config)`

Return a `HighwayResponse` — the full chart data for one arrangement. This is called on every player load, so it should be reasonably fast (no network calls; disk reads are fine).

`arrangements` is the array of `{ index, name, notes }` objects stored when the song was imported. Use `arrangementIndex` to pick which one to load.

```typescript
loadHighway(
  filePath: string,
  arrangements: ArrangementData[],
  arrangementIndex: number,
  config: ImportFormatConfig,
): HighwayResponse {
  const arr = arrangements[arrangementIndex];
  const chart = readMyChart(filePath, arr.name);

  return {
    song_info: {
      title:             chart.title,
      artist:            chart.artist,
      album:             chart.album,
      arrangement:       arr.name,
      arrangement_index: arrangementIndex,
      arrangements:      arrangements.map(a => ({ index: a.index, name: a.name, notes: a.notes })),
      duration:          chart.duration,
      tuning:            chart.tuning,    // [s0, s1, s2, s3, s4, s5] semitone offsets
      capo:              chart.capo,
      offset:            chart.offset,    // song start offset in seconds
      stringCount:       6,
      format:            "my-format",
    },
    beats:          chart.beats,          // [{ time, measure }]
    sections:       chart.sections,       // [{ time, name }]
    notes:          chart.notes,          // see WireNote shape below
    chords:         chart.chords,
    anchors:        chart.anchors,
    handshapes:     chart.handShapes,
    chord_templates: chart.chordTemplates,
    lyrics:         [],
    tone_changes:   [],
    tone_base:      "",
    phrases:        undefined,            // omit unless you have phrase difficulty data
  };
}
```

#### WireNote shape

```typescript
{
  t:    number    // time in seconds
  d:    number    // duration in seconds
  f:    number    // fret (0 = open)
  s:    number    // string index (0 = lowest)
  b?:   number[]  // bend values (semitones × 100)
  sl?:  number    // slide-to fret
  ho?:  boolean   // hammer-on
  po?:  boolean   // pull-off
  tap?: boolean
  pm?:  boolean   // palm mute
  vib?: boolean   // vibrato
  acc?: boolean   // accent
  hm?:  boolean   // harmonic
  phi?: boolean   // pinch harmonic
}
```

Full type definitions live in `backend/src/domain/models/song.ts`. See [Player & Highway](player.md) for the complete `HighwayResponse` reference.

---

### `resolveStaticFile(filename, relPath, config)` *(optional)*

Implement this if your format has internal files (stems, images, assets) that the frontend needs to fetch individually. The backend exposes them at `GET /api/tracks/:id/static/:relPath`.

Always validate `relPath` to prevent path traversal:

```typescript
resolveStaticFile(filename: string, relPath: string, config: ImportFormatConfig): string | null {
  if (relPath.includes("..") || relPath.startsWith("/") || relPath.includes("\\")) return null;
  const base = path.resolve(path.dirname(filename));
  const resolved = path.resolve(base, relPath);
  if (!resolved.startsWith(base + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}
```

---

## Registering the provider

In your plugin's `index.js` entry point:

```javascript
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const providerPath = path.resolve(__dirname, "./dist/MyFormatProvider.js");

export async function setup(ctx) {
  const { MyFormatProvider } = await import(providerPath);
  ctx.import.registerFormat(new MyFormatProvider());
  ctx.logger.info("my-format provider registered");
}
```

The call to `ctx.import.registerFormat()` is the only wiring needed — the scanner picks it up automatically.

---

## Plugin structure

```
my-format-plugin/
├── plugin.json
├── index.js              # ESM entry — calls ctx.import.registerFormat()
├── package.json          # "type": "module", has build script
├── build.mjs             # esbuild build script
└── src/
    └── MyFormatProvider.ts
```

### `plugin.json`

```json
{
  "id": "format-my-format",
  "name": "My Format",
  "version": "1.0.0",
  "server": "index.js",
  "dependsOn": []
}
```

### `build.mjs`

Format providers import from `backend/src/` — they need esbuild's `nodePaths` to resolve those imports, and a `createRequire` banner to handle any bundled CJS packages:

```javascript
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../../backend");

await build({
  entryPoints: [path.join(__dirname, "src/MyFormatProvider.ts")],
  outdir:      path.join(__dirname, "dist"),
  bundle:      true,
  platform:    "node",
  format:      "esm",
  target:      "node20",
  sourcemap:   true,
  external: [
    "node:fs", "node:path", "node:os", "node:crypto", "node:zlib",
    "node:child_process", "node:url", "node:stream", "node:util",
    "node:events", "node:buffer",
    "fs", "path", "os", "crypto", "zlib", "child_process", "url",
    "stream", "util", "events", "buffer",
  ],
  nodePaths: [path.join(backendRoot, "node_modules")],
  banner: {
    js: `import { createRequire } from "module"; const require = createRequire(import.meta.url);`,
  },
});
```

Run `node build.mjs` to compile. The built files land in `dist/`.

---

## Minimal working example

A provider that reads plain JSON song files (`*.songpack`):

```typescript
// src/JsonSongProvider.ts
import fs from "node:fs";
import type { IImportFormatProvider, ImportFormatConfig } from
  "../../../backend/src/domain/interfaces/providers/IImportFormatProvider.js";
import type { ArrangementData } from
  "../../../backend/src/domain/models/track.js";
import type { HighwayResponse } from
  "../../../backend/src/domain/models/highway.js";

export class JsonSongProvider implements IImportFormatProvider {
  readonly name = "songpack";

  canHandle(filePath: string): boolean {
    return filePath.endsWith(".songpack");
  }

  extractMeta(filePath: string): Record<string, unknown> {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      title:         data.title ?? "",
      artist:        data.artist ?? "",
      album:         data.album ?? "",
      duration:      data.duration ?? 0,
      tuning:        data.tuningName ?? "E Standard",
      tuningSortKey: 0,
      arrangements:  (data.arrangements ?? []).map((a: any, i: number) => ({
                       index: i, name: a.name, notes: a.notes?.length ?? 0,
                     })),
      hasLyrics:     false,
      format:        "songpack",
      stemCount:     0,
      stemIds:       [],
    };
  }

  extractCoverArt(): Buffer | null {
    return null;
  }

  async extractAudio(filePath: string): Promise<string | null> {
    const audio = filePath.replace(".songpack", ".ogg");
    return fs.existsSync(audio) ? audio : null;
  }

  loadHighway(
    filePath: string,
    arrangements: ArrangementData[],
    arrangementIndex: number,
  ): HighwayResponse {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const arr = data.arrangements?.[arrangementIndex] ?? {};
    return {
      song_info: {
        title: data.title, artist: data.artist, album: data.album ?? "",
        arrangement: arr.name ?? "Lead", arrangement_index: arrangementIndex,
        arrangements: arrangements.map(a => ({ index: a.index, name: a.name, notes: a.notes })),
        duration: data.duration ?? 0,
        tuning: [0, 0, 0, 0, 0, 0], capo: 0, offset: 0, stringCount: 6,
        format: "songpack",
      },
      beats:           arr.beats ?? [],
      sections:        arr.sections ?? [],
      notes:           arr.notes ?? [],
      chords:          arr.chords ?? [],
      anchors:         arr.anchors ?? [],
      handshapes:      arr.handShapes ?? [],
      chord_templates: arr.chordTemplates ?? [],
      lyrics:          [],
      tone_changes:    [],
      tone_base:       "",
    };
  }
}
```

---

## Full TypeScript plugin — server + client from scratch

This is a complete, copy-paste starter for a format plugin that compiles both a Node.js backend module (`server.js`) and a browser settings panel (`client.js`) from TypeScript. Swap out the parsing logic in `MyFormatProvider.ts` for your own format.

### File layout

```
format-my-format/
├── plugin.json
├── package.json
├── build.mjs
├── tsconfig.json
└── src/
    ├── MyFormatProvider.ts   ← the format logic
    ├── server.ts             ← backend entry: registers provider + API routes
    └── client.ts             ← frontend entry: settings panel
```

---

### `plugin.json`

```json
{
  "id": "format-my-format",
  "name": "My Format",
  "version": "0.0.1",
  "server": "dist/server.js",
  "component": "dist/client.js",
  "dependsOn": []
}
```

`"server"` is loaded by Node.js at startup. `"component"` is loaded by the browser as an ES module and must export a `setup(ctx)` function.

---

### `package.json`

```json
{
  "name": "format-my-format",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "node build.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "typescript": "^5.0.0"
  }
}
```

---

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

`noEmit: true` — TypeScript is only used for type checking. esbuild does the actual compilation.

---

### `build.mjs`

Compiles both entry points in one pass. The server build resolves backend types via `nodePaths`; the client build targets the browser and excludes node builtins.

```javascript
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../../backend");

const NODE_EXTERNALS = [
  "node:fs", "node:path", "node:os", "node:crypto", "node:zlib",
  "node:child_process", "node:url", "node:stream", "node:util",
  "node:events", "node:buffer", "node:process",
  "fs", "path", "os", "crypto", "zlib", "child_process",
  "url", "stream", "util", "events", "buffer",
];

// ── Server bundle (Node.js ESM) ───────────────────────────────────────────
await build({
  entryPoints: [path.join(__dirname, "src/server.ts")],
  outfile:     path.join(__dirname, "dist/server.js"),
  bundle:      true,
  platform:    "node",
  format:      "esm",
  target:      "node20",
  sourcemap:   true,
  external:    NODE_EXTERNALS,
  nodePaths:   [path.join(backendRoot, "node_modules")],
  // Polyfill require() for any bundled CJS packages
  banner: {
    js: `import { createRequire } from "module"; const require = createRequire(import.meta.url);`,
  },
});

// ── Client bundle (Browser ESM) ───────────────────────────────────────────
// Vue is provided at runtime by the host via window.__sloprockVue —
// nothing to externalize here. FrontendPluginContext is types-only.
await build({
  entryPoints: [path.join(__dirname, "src/client.ts")],
  outfile:     path.join(__dirname, "dist/client.js"),
  bundle:      true,
  platform:    "browser",
  format:      "esm",
  target:      "es2022",
  sourcemap:   true,
});

console.log("Built dist/server.js and dist/client.js");
```

---

### `src/MyFormatProvider.ts`

The format logic. Adjust `canHandle` and the parsing functions for your format.

```typescript
import fs from "node:fs";
import path from "node:path";
import type {
  IImportFormatProvider,
  ImportFormatConfig,
} from "../../../backend/src/domain/interfaces/providers/IImportFormatProvider.js";
import type { ArrangementData } from
  "../../../backend/src/domain/models/track.js";
import type { HighwayResponse } from
  "../../../backend/src/domain/models/highway.js";

interface MyManifest {
  title:        string;
  artist:       string;
  album?:       string;
  duration:     number;
  arrangements: Array<{ name: string; file: string }>;
}

export class MyFormatProvider implements IImportFormatProvider {
  readonly name = "my-format";

  // Injected at construction so the server module can update it at runtime
  // (e.g. after the user saves a new path via the settings panel).
  constructor(private getOption: () => string = () => "") {}

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith(".myfmt");
  }

  extractMeta(filePath: string, _config: ImportFormatConfig): Record<string, unknown> {
    const manifest = this.readManifest(filePath);
    return {
      title:         manifest.title,
      artist:        manifest.artist,
      album:         manifest.album ?? "",
      duration:      manifest.duration,
      tuning:        "E Standard",
      tuningSortKey: 0,
      arrangements:  manifest.arrangements.map((a, i) => ({
                       index: i, name: a.name, notes: 0,
                     })),
      hasLyrics:     false,
      format:        this.name,
      stemCount:     0,
      stemIds:       [],
    };
  }

  extractCoverArt(filePath: string, _config: ImportFormatConfig): Buffer | null {
    const cover = path.join(path.dirname(filePath), "cover.jpg");
    return fs.existsSync(cover) ? fs.readFileSync(cover) : null;
  }

  async extractAudio(filePath: string, _trackId: string, _config: ImportFormatConfig): Promise<string | null> {
    const ogg = path.join(path.dirname(filePath), "audio.ogg");
    return fs.existsSync(ogg) ? ogg : null;
  }

  loadHighway(
    filePath: string,
    arrangements: ArrangementData[],
    arrangementIndex: number,
    _config: ImportFormatConfig,
  ): HighwayResponse {
    const manifest  = this.readManifest(filePath);
    const arrMeta   = arrangements[arrangementIndex] ?? { index: 0, name: "Lead", notes: 0 };
    const arrEntry  = manifest.arrangements.find(a => a.name === arrMeta.name);
    const chartFile = arrEntry ? path.join(path.dirname(filePath), arrEntry.file) : null;
    const chart     = chartFile && fs.existsSync(chartFile)
                        ? JSON.parse(fs.readFileSync(chartFile, "utf8"))
                        : {};

    return {
      song_info: {
        title:             manifest.title,
        artist:            manifest.artist,
        album:             manifest.album ?? "",
        arrangement:       arrMeta.name,
        arrangement_index: arrangementIndex,
        arrangements:      arrangements.map(a => ({ index: a.index, name: a.name, notes: a.notes })),
        duration:          manifest.duration,
        tuning:            [0, 0, 0, 0, 0, 0],
        capo:              0,
        offset:            0,
        stringCount:       6,
        format:            this.name,
      },
      beats:           chart.beats           ?? [],
      sections:        chart.sections        ?? [],
      notes:           chart.notes           ?? [],
      chords:          chart.chords          ?? [],
      anchors:         chart.anchors         ?? [],
      handshapes:      chart.handShapes      ?? [],
      chord_templates: chart.chordTemplates  ?? [],
      lyrics:          [],
      tone_changes:    [],
      tone_base:       "",
    };
  }

  private readManifest(filePath: string): MyManifest {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as MyManifest;
  }
}
```

---

### `src/server.ts`

Registers the provider and exposes a small config API so the settings panel can read and write the plugin's persistent option.

```typescript
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { PluginContext } from "../../../backend/src/infrastructure/plugins/PluginLifecycle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setup(ctx: PluginContext): Promise<void> {
  // Dynamic import keeps the provider out of the server bundle —
  // it was compiled to its own file by esbuild.
  const { MyFormatProvider } = await import(
    path.resolve(__dirname, "./MyFormatProvider.js")
  );

  // Load persisted option; fall back to env var, then empty string
  let option = (await ctx.db.get<string>("option"))
    ?? process.env.MY_FORMAT_OPTION
    ?? "";

  // Pass a getter so the provider always reads the latest value
  ctx.import.registerFormat(new MyFormatProvider(() => option));

  // GET /api/plugins/format-my-format/config
  ctx.routes.register("GET", "config", async () => ({ option }));

  // POST /api/plugins/format-my-format/config
  ctx.routes.register("POST", "config", async (req) => {
    const body = req.body as Record<string, unknown> | undefined;
    if (typeof body?.option === "string") {
      option = body.option;
      await ctx.db.set("option", option);
    }
    return { option };
  });

  ctx.logger.info(`my-format provider registered (option="${option}")`);
}

export async function teardown(ctx: PluginContext): Promise<void> {
  ctx.logger.info("my-format unloaded");
}
```

---

### `src/client.ts`

A settings panel rendered with Vue 3's `h` API. The host injects Vue at runtime via `window.__sloprockVue` — no Vue import needed.

```typescript
// Type-only import — erased by esbuild, never in the browser bundle
import type { FrontendPluginContext } from
  "../../../frontend/src/plugins/FrontendPluginContext.js";

// The host puts Vue on window before loading plugin components
declare const window: Window & {
  __sloprockVue: {
    h: typeof import("vue").h;
    ref: typeof import("vue").ref;
    defineComponent: typeof import("vue").defineComponent;
  };
};

export async function setup(ctx: FrontendPluginContext): Promise<void> {
  const { h, ref, defineComponent } = window.__sloprockVue;

  const SettingsPanel = defineComponent({
    name: "MyFormatSettings",
    setup() {
      const option  = ref("");
      const loading = ref(true);
      const saved   = ref(false);
      const error   = ref("");

      async function load() {
        try {
          const data = await ctx.api.get<{ option: string }>("config");
          option.value  = data.option;
        } catch (e) {
          error.value = String(e);
        } finally {
          loading.value = false;
        }
      }

      async function save() {
        error.value = "";
        try {
          await ctx.api.post("config", { option: option.value });
          saved.value = true;
          setTimeout(() => { saved.value = false; }, 2500);
        } catch (e) {
          error.value = String(e);
        }
      }

      load();

      return () => {
        if (loading.value) return h("p", { class: "settings-hint" }, "Loading…");

        return h("div", { class: "settings-section" }, [
          h("h3", { class: "settings-heading" }, "My Format"),

          h("div", { class: "settings-row" }, [
            h("label", { class: "settings-label" }, "Option"),
            h("input", {
              class:   "settings-input",
              value:   option.value,
              onInput: (e: Event) => {
                option.value = (e.target as HTMLInputElement).value;
              },
              placeholder: "optional value",
            }),
          ]),

          error.value
            ? h("p", { class: "settings-error" }, error.value)
            : null,

          h("button", {
            class:   "settings-btn",
            onClick: save,
          }, saved.value ? "Saved!" : "Save"),
        ]);
      };
    },
  });

  ctx.slots.register("settings-panel", SettingsPanel, { order: 40 });
}
```

---

### Running the build

```bash
cd format-my-format
npm install
npm run build       # → dist/server.js  dist/client.js
```

Drop the folder into your user plugins directory. On next server start the plugin is discovered, `setup()` is called, and the format is available for scanning. The settings panel appears under **Settings → Plugins → My Format**.

---

## See Also

- [Plugin Development Guide](plugin-development-guide.md) — full plugin system, routes, hooks, UI slots
- [SlopPak Format](sloppak-format.md) — reference for the built-in open format
- [Player & Highway](player.md) — complete `HighwayResponse` field reference
- [Plugin System Overview](plugin-system-overview.md) — lifecycle and architecture
