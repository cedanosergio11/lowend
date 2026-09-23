import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

/**
 * Match Vite `base` (e.g. `/lowend/` on GitHub Pages; `/` locally).
 * Always keep a leading slash — `basepath: "lowend"` (no slash) leaves #root empty.
 */
function routerBasepath(): string {
  const raw = import.meta.env.BASE_URL || "/";
  let path = raw.replace(/\/$/, "");
  if (!path) return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

export function getRouter() {
  return createRouter({
    routeTree,
    basepath: routerBasepath(),
    defaultErrorComponent: AppErrorComponent,
  });
}
