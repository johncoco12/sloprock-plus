import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const providerPath = path.resolve(__dirname, "./dist/SloppakFormatProvider.js");

export async function setup(ctx) {
  const { SloppakFormatProvider } = await import(providerPath);
  ctx.import.registerFormat(new SloppakFormatProvider());
  ctx.logger.info("Sloppak format provider registered");
}
