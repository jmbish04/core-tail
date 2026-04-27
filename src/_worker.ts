/**
 * @fileoverview Cloudflare Workers entry point
 */
import type { ExportedHandler } from '@cloudflare/workers-types';
import { app as honoApp } from './backend/api/index';
import type { Bindings } from './backend/api/index';

const handler: ExportedHandler<Bindings> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle API and Documentation routes
    if (
      url.pathname.startsWith('/api/') || 
      url.pathname === '/openapi.json' || 
      url.pathname === '/swagger' || 
      url.pathname === '/scalar' || 
      url.pathname === '/docs'
    ) {
      return honoApp.fetch(request, env, ctx);
    }

    // Let Astro handle everything else via the ASSETS binding
    return env.ASSETS.fetch(request);
  },

  /**
   * BARE MINIMUM TAIL HANDLER
   * This satisfies the requirement for other workers to bind to this service.
   */
  async tail(events, env, ctx) {
    // We do nothing for now, just consume the events so the deployment is valid
    return;
  }
};

export default handler;
