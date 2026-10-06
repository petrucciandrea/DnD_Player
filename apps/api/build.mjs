import { readFile } from "node:fs/promises";
import { build } from "esbuild";

// Un solo file per la produzione, con @dnd/regole incluso. Restano fuori le dipendenze di npm
// dichiarate in package.json, installate nell'immagine Docker con `npm ci --omit=dev`.
const { dependencies } = JSON.parse(await readFile(new URL("package.json", import.meta.url), "utf8"));
const esterne = Object.keys(dependencies).filter(d => !d.startsWith("@dnd/"));
await build({
  entryPoints: ["src/principale.ts"],
  outfile: "dist/principale.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  external: esterne,
  logLevel: "info",
});
