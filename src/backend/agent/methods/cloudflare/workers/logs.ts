/**
 * @fileoverview Fetch worker logs (observability + build) via the Cloudflare SDK.
 *
 * Provides two categories of log access:
 * 1. Runtime logs — from the Workers observability/telemetry API
 * 2. Build logs — deployment version history and build metadata
 */

import Cloudflare from "cloudflare";
import type { WorkerLogsResult, WorkerLogEntry } from "@/backend/agent/types";
import { getSecret } from "@/backend/utils/secrets";

/**
 * Fetch recent observability logs for a specific Worker.
 *
 * Uses the Workers Telemetry/Observability API via the SDK to retrieve
 * structured log events including console.log output, exceptions, and
 * request metadata.
 */
export async function fetchWorkerLogs(
  env: Env,
  workerName: string,
  options: {
    limit?: number;
    sinceMinutes?: number;
    outcomeFilter?: string;
  } = {},
): Promise<WorkerLogsResult> {
  const accountId = await getSecret(env, "CLOUDFLARE_ACCOUNT_ID") as string;
  const apiToken = await getSecret(env, "CLOUDFLARE_WRANGLER_API_TOKEN") as string;

  if (!accountId || !apiToken) {
    return {
      success: false,
      logs: [],
      error: "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_WRANGLER_API_TOKEN",
    };
  }

  const { limit = 50, sinceMinutes = 60 } = options;
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();

  try {
    const client = new Cloudflare({ apiToken });

    // Use the Workers Telemetry API to query recent logs
    // This uses the observability logs endpoint for the specified script
    const response = await client.post(
      `/accounts/${accountId}/workers/observability/telemetry/query`,
      {
        body: {
          query: {
            scriptName: workerName,
            since,
            limit,
            orderBy: "timestamp",
            order: "desc",
          },
        },
      },
    );

    const data = response as any;
    const entries: WorkerLogEntry[] = [];

    if (data?.result?.events && Array.isArray(data.result.events)) {
      for (const event of data.result.events) {
        // Extract log entries from each event
        if (event.logs && Array.isArray(event.logs)) {
          for (const log of event.logs) {
            entries.push({
              message: typeof log.message === "string"
                ? log.message
                : JSON.stringify(log.message),
              level: log.level || "log",
              timestamp: event.eventTimestamp || new Date().toISOString(),
              scriptName: workerName,
              outcome: event.outcome,
            });
          }
        }

        // Include exceptions as error-level log entries
        if (event.exceptions && Array.isArray(event.exceptions)) {
          for (const exc of event.exceptions) {
            entries.push({
              message: `${exc.name}: ${exc.message}`,
              level: "error",
              timestamp: event.eventTimestamp || new Date().toISOString(),
              scriptName: workerName,
              outcome: event.outcome,
            });
          }
        }
      }
    }

    return { success: true, logs: entries };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Agent:Logs] Failed to fetch logs for "${workerName}":`, message);

    return { success: false, logs: [], error: message };
  }
}

/**
 * Fetch deployment/build history for a Worker.
 *
 * Returns recent version deployments so the agent can correlate errors
 * with specific deployments.
 */
export async function fetchWorkerDeployments(
  env: Env,
  workerName: string,
  limit = 10,
): Promise<{ success: boolean; deployments: any[]; error?: string }> {
  const accountId = await getSecret(env, "CLOUDFLARE_ACCOUNT_ID") as string;
  const apiToken = await getSecret(env, "CLOUDFLARE_WRANGLER_API_TOKEN") as string;

  if (!accountId || !apiToken) {
    return { success: false, deployments: [], error: "Missing credentials" };
  }

  try {
    const client = new Cloudflare({ apiToken });

    // Fetch version/deployment history via the SDK
    const response = await client.workers.scripts.versions.list(workerName, {
      account_id: accountId,
    });

    const versions: any[] = [];
    let count = 0;

    // The SDK returns an async iterable for paginated lists
    for await (const version of response) {
      if (count >= limit) break;
      versions.push({
        id: version.id,
        metadata: version.metadata,
        created_on: (version as any).created_on,
      });
      count++;
    }

    return { success: true, deployments: versions };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Agent:Logs] Failed to fetch deployments for "${workerName}":`, message);

    return { success: false, deployments: [], error: message };
  }
}

/**
 * Fetch error-only logs for a Worker within a time window.
 *
 * Convenience wrapper that filters for exceptions and error outcomes
 * to give the agent focused diagnostic data.
 */
export async function fetchWorkerErrors(
  env: Env,
  workerName: string,
  sinceMinutes = 30,
): Promise<WorkerLogEntry[]> {
  const result = await fetchWorkerLogs(env, workerName, {
    limit: 100,
    sinceMinutes,
    outcomeFilter: "exception",
  });

  if (!result.success) return [];

  return result.logs.filter(
    (log) => log.level === "error" || log.outcome === "exception",
  );
}
