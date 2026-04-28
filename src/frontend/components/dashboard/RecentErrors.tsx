import * as React from "react";
import { logger } from "@/lib/logger";
import { apiFetch } from "@/lib/api";

interface LogEntry {
  id: number;
  workerName: string;
  eventTimestamp: string;
  exceptions: any[];
}

export function RecentErrors() {
  const [errors, setErrors] = React.useState<LogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadErrors();
  }, []);

  async function loadErrors() {
    try {
      const { ok, status, data } = await apiFetch("/api/logs?outcome=exception&limit=10");
      if (!ok) {
        logger.error(
          "Failed to load recent errors",
          data.error || "Server returned " + status,
          `## API Error - Recent Errors\n\n**Endpoint:** /api/logs?outcome=exception&limit=10\n**Status:** ${status}`
        );
        return;
      }
      setErrors(data.logs || []);
    } catch (error) {
      logger.error(
        "Network Error",
        error,
        `## Recent Errors Load Error\n\nFailed to fetch from /api/logs?outcome=exception.`
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading recent errors...</p>;
  }

  if (errors.length === 0) {
    return <p className="text-gray-500">No recent errors</p>;
  }

  return (
    <div className="space-y-4">
      {errors.map((log) => {
        const timestamp = new Date(log.eventTimestamp).toLocaleString();
        const exceptions = log.exceptions || [];
        const firstException = exceptions[0] || {
          name: "Unknown",
          message: "No details available",
        };

        return (
          <div key={log.id} className="border-l-4 border-red-500 pl-4 py-2">
            <div className="flex justify-between items-start mb-1">
              <span className="font-semibold">{log.workerName}</span>
              <span className="text-sm text-gray-500">{timestamp}</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {firstException.name}: {firstException.message}
            </p>
            <a
              href={`/worker/${encodeURIComponent(log.workerName)}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View details →
            </a>
          </div>
        );
      })}
    </div>
  );
}
