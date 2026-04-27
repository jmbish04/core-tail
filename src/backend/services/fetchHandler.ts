import { app as honoApp } from "../api/index";
import type { Bindings } from "../api/index";
import type { ExecutionContext } from "@cloudflare/workers-types";

export async function processFetchEvent(request: Request, env: Bindings, ctx: ExecutionContext) {
  const url = new URL(request.url);

  // Handle API and Documentation routes
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/openapi.json" ||
    url.pathname === "/swagger" ||
    url.pathname === "/scalar" ||
    url.pathname === "/docs"
  ) {
    return honoApp.fetch(request, env, ctx);
  }

  // Let Astro handle everything else via the ASSETS binding
  return env.ASSETS.fetch(request);
}
