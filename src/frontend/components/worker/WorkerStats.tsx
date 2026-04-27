import * as React from "react";

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
      const res = await fetch(`/api/logs/stats?workerName=${encodeURIComponent(workerName)}`);
      const data = await res.json();
      const workerStats = data.byWorker[workerName] || {};

      const total = Object.values(workerStats).reduce((sum: number, count: any) => sum + count, 0);
      const success = workerStats.ok || 0;
      const exceptions = workerStats.exception || 0;
      const other =
        (workerStats.canceled || 0) +
        (workerStats.exceededCpu || 0) +
        (workerStats.exceededMemory || 0) +
        (workerStats.unknown || 0);

      setStats({ total, success, exceptions, other });
    } catch (error) {
      console.error("Error loading worker stats:", error);
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
