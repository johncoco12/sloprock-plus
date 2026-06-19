import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const providerPath    = path.resolve(__dirname, "./dist/GuitarProFormatProvider.js");
const importRoutePath = path.resolve(__dirname, "./dist/GuitarProImportRoute.js");

export async function setup(ctx) {
  const [{ GuitarProFormatProvider }, { registerImportRoute }] = await Promise.all([
    import(providerPath),
    import(importRoutePath),
  ]);

  ctx.import.registerFormat(new GuitarProFormatProvider());
  registerImportRoute(ctx);

  ctx.logger.info("Guitar Pro format provider registered (.gp / .gpx)");
}
