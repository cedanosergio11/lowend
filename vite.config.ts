import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isGitHubPages =
  process.env.GITHUB_PAGES === "1" ||
  Boolean(process.env.BASE_PATH && process.env.BASE_PATH.length > 0);

function pagesBase(): string {
  const raw = process.env.BASE_PATH?.trim() || "/lowend/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/**
 * `new URL("./pitch-worklet.ts", import.meta.url)` is emitted by Vite as a raw
 * static asset with a `.ts` extension. GitHub Pages serves `.ts` as video/mp2t,
 * which audioWorklet.addModule() rejects. The worklet source is plain-JS syntax,
 * so rename the emitted asset to `.js` and rewrite references to it.
 */
function workletAssetAsJs(): Plugin {
  return {
    name: "lowend-worklet-asset-js",
    apply: "build",
    generateBundle(_opts, bundle) {
      const renames: [string, string][] = [];
      for (const [key, out] of Object.entries(bundle)) {
        if (out.type === "asset" && /pitch-worklet-[^/]*\.ts$/.test(out.fileName)) {
          const next = out.fileName.replace(/\.ts$/, ".js");
          renames.push([out.fileName, next]);
          const source = out.source;
          delete bundle[key];
          this.emitFile({ type: "asset", fileName: next, source });
        }
      }
      if (!renames.length) return;
      for (const out of Object.values(bundle)) {
        if (out.type !== "chunk") continue;
        for (const [from, to] of renames) {
          const base = from.split("/").pop()!;
          out.code = out.code.split(base).join(to.split("/").pop()!);
        }
      }
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  ...(isGitHubPages ? { base: pagesBase() } : {}),
  server: { host: "0.0.0.0", port: 8080, strictPort: true },
  preview: { host: "127.0.0.1", port: 8081, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    workletAssetAsJs(),
    // Start strips leading "/" from Vite base ("/lowend/" → "lowend") then
    // hydrateStart overwrites createRouter basepath — pin explicitly.
    tanstackStart(
      isGitHubPages
        ? {
            router: {
              basepath: pagesBase().replace(/\/$/, "") || "/",
            },
            spa: {
              enabled: true,
              prerender: {
                onSuccess: ({ html }) => {
                  const dir = join(process.cwd(), "dist/client");
                  writeFileSync(join(dir, "index.html"), html);
                  writeFileSync(join(dir, "404.html"), html);
                  writeFileSync(join(dir, ".nojekyll"), "");
                },
              },
            },
          }
        : undefined,
    ),
    viteReact(),
  ],
}));
