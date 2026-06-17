#!/usr/bin/env node
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const NODE_BUILTIN_EXTERNALS = [
  "node:fs", "node:path", "node:os", "node:crypto", "node:zlib",
  "node:child_process", "node:url", "node:stream", "node:util",
  "node:events", "node:buffer", "node:http", "node:https", "node:net",
  "node:tls", "node:dgram", "node:dns", "node:readline", "node:repl",
  "node:vm", "node:assert", "node:cluster", "node:module", "node:worker_threads",
  "node:perf_hooks", "node:process", "node:timers", "node:constants",
  "fs", "path", "os", "crypto", "zlib", "child_process", "url", "stream",
  "util", "events", "buffer", "http", "https", "net", "tls", "dgram",
  "dns", "readline", "repl", "vm", "assert", "cluster", "module", "worker_threads",
];

const PLUGINS = [
  {
    name: "format_sloppak",
    entryPoints: [
      "plugins/format_sloppak/src/SloppakFormatProvider.ts",
      "plugins/format_sloppak/src/SloppakLoader.ts",
    ],
    outdir: "plugins/format_sloppak/dist",
  },
  {
    name: "format_loose",
    entryPoints: [
      "plugins/format_loose/src/LooseFormatProvider.ts",
      "plugins/format_loose/src/LooseFolderReader.ts",
    ],
    outdir: "plugins/format_loose/dist",
  },
];

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: NODE_BUILTIN_EXTERNALS,
  nodePaths: [path.join(repoRoot, "backend/node_modules")],
  sourcemap: true,
  logLevel: "info",
  // CJS packages (adm-zip, etc.) call require() inside esbuild's __commonJS
  // wrapper; in an ESM bundle require is undefined, so inject a polyfill.
  banner: {
    js: `import { createRequire } from "module"; const require = createRequire(import.meta.url);`,
  },
};

for (const plugin of PLUGINS) {
  console.log(`\nBuilding ${plugin.name}...`);
  await build({
    ...shared,
    entryPoints: plugin.entryPoints.map((e) => path.join(repoRoot, e)),
    outdir: path.join(repoRoot, plugin.outdir),
    absWorkingDir: repoRoot,
  });
}

console.log("\nAll plugins built successfully.");
