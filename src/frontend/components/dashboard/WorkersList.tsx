import * as React from "react";
import { logger } from "@/lib/logger";
import { apiFetch } from "@/lib/api";
import { ExternalLinkIcon, ServerIcon } from "lucide-react";

import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

interface WorkersListProps {
  stats: any;
}

export function WorkersList({ stats }: WorkersListProps) {
  const [workers, setWorkers] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadWorkers();
  }, []);

  async function loadWorkers() {
    try {
      const { ok, status, data } = await apiFetch("/api/logs/workers");
      if (!ok) {
        console.error("[WorkersList] Failed to load workers, status:", status);
        logger.error(
          "Failed to load workers",
          data.error || "Server returned " + status,
          `## API Error - Workers List\n\n**Endpoint:** /api/logs/workers\n**Status:** ${status}`
        );
        return;
      }
      setWorkers(data.workers || []);
    } catch (error) {
      console.error("[WorkersList] Network error:", error);
      logger.error(
        "Network Error",
        error,
        `## Workers Load Error\n\nFailed to fetch from /api/logs/workers.`
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground py-4">Loading workers...</p>;
  }

  if (workers.length === 0) {
    return <p className="text-muted-foreground py-4">No workers reporting logs yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-foreground font-semibold">Worker Name</TableHead>
          <TableHead className="text-foreground font-semibold text-right">Total Events</TableHead>
          <TableHead className="text-foreground font-semibold text-right">Success</TableHead>
          <TableHead className="text-foreground font-semibold text-right">Errors</TableHead>
          <TableHead className="text-foreground font-semibold text-right">Error Rate</TableHead>
          <TableHead className="text-foreground font-semibold text-right">Status</TableHead>
          <TableHead className="text-foreground font-semibold text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workers.map((worker) => {
          const workerStats = stats?.byWorker?.[worker] || {};
          const total = Object.values(workerStats).reduce(
            (sum: number, count: any) => sum + count,
            0,
          );
          const ok = workerStats.ok || 0;
          const errors =
            (workerStats.exception || 0) +
            (workerStats.exceededCpu || 0) +
            (workerStats.exceededMemory || 0);
          const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : "0.0";
          const isHealthy = Number(errorRate) < 5;
          const isWarning = Number(errorRate) >= 5 && Number(errorRate) < 15;

          return (
            <TableRow key={worker} className="hover:bg-zinc-900/50 transition-colors">
              <TableCell className="font-mono text-sm text-foreground">
                <div className="flex items-center gap-2">
                  <ServerIcon className="h-4 w-4 text-muted-foreground" />
                  {worker}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground font-medium">
                {total.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums text-emerald-400 font-medium">
                {ok.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums text-red-400 font-medium">
                {errors.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                <span className={isHealthy ? "text-emerald-400" : isWarning ? "text-yellow-400" : "text-red-400"}>
                  {errorRate}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={isHealthy ? "default" : isWarning ? "secondary" : "destructive"}
                  className={
                    isHealthy
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                      : isWarning
                        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
                        : ""
                  }
                >
                  {isHealthy ? "Healthy" : isWarning ? "Warning" : "Critical"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <a
                  href={`/worker/${encodeURIComponent(worker)}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Details
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
