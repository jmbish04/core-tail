import * as React from "react";
import { logger } from "@/lib/logger";
import { apiFetch } from "@/lib/api";

import { Card } from "../ui/card";

interface WorkerStatsProps {
  workerName: string;
}

interface WorkerStats {
  total: number;
  success: number;
  exceptions: number;
  other: number;
}

export function WorkerStats({ workerName }: WorkerStatsProps) {
  const [stats, setStats] = React.useState<WorkerStats>({
    total: 0,
    success: 0,
    exceptions: 0,
    other: 0,
  });

  React.useEffect(() => {
    loadStats();
  }, [workerName]);

  async function loadStats() {
    try {
      const { data } = await apiFetch(`/api/logs/stats?workerName=${encodeURIComponent(workerName)}`);
      const workerStatsData = data.byWorker[workerName] || {};

      const total = Object.values(workerStatsData).reduce((sum: number, count: any) => sum + count, 0);
      const success = workerStatsData.ok || 0;
      const exceptions = workerStatsData.exception || 0;
      const other =
        (workerStatsData.canceled || 0) +
        (workerStatsData.exceededCpu || 0) +
        (workerStatsData.exceededMemory || 0) +
        (workerStatsData.unknown || 0);

      setStats({ total, success, exceptions, other });
    } catch (error: any) {
      logger.error(
        "Failed to Load Stats",
        error,
        `## API Error - Worker Stats\n\nFailed to load worker stats for ${workerName}.\n\nError: ${error.message}`
      );
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Total Logs</h3>
        <p className="text-2xl font-bold">{stats.total}</p>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Success</h3>
        <p className="text-2xl font-bold text-green-600">{stats.success}</p>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Exceptions</h3>
        <p className="text-2xl font-bold text-red-600">{stats.exceptions}</p>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Other Errors</h3>
        <p className="text-2xl font-bold text-orange-600">{stats.other}</p>
      </Card>
    </div>
  );
}
