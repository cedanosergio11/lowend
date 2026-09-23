import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vite";
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

export default defineConfig(({ command, isPreview }) => ({
  ...(isGitHubPages ? { base: pagesBase() } : {}),
  server: { host: "0.0.0.0", port: 8080, strictPort: true },
  preview: { host: "127.0.0.1", port: 8081, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(
      isGitHubPages
        ? {
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
