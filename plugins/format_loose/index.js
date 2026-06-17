import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const providerPath = path.resolve(__dirname, "./dist/LooseFormatProvider.js");

export async function setup(ctx) {
  const { LooseFormatProvider } = await import(providerPath);
  ctx.import.registerFormat(new LooseFormatProvider());
  ctx.logger.info("Loose folder format provider registered");
}
