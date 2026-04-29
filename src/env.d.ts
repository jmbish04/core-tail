/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type Env = import("../worker-configuration").Env;
type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    // Add any custom locals here
  }
}
