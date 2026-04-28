import * as React from "react";

import { Card } from "../ui/card";
import { RecentErrors } from "./RecentErrors";
import { StatsCard } from "./StatsCard";
import { StatsCharts } from "./StatsCharts";
import { WorkersList } from "./WorkersList";

interface DashboardStats {
  overview: {
    totalLogs: number;
    errorCount: number;
    errorRate: number;
  };
  byOutcome: Array<{ outcome: string; count: number }>;
  byWorker: Record<string, Record<string, number>>;
}

export function Dashboard() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch("/api/logs/stats");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8">Worker Logs Dashboard</h1>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard title="Total Logs" value={loading ? "-" : stats?.overview.totalLogs || 0} />
        <StatsCard
          title="Error Count"
          value={loading ? "-" : stats?.overview.errorCount || 0}
          className="text-red-600"
        />
        <StatsCard
          title="Error Rate"
          value={loading ? "-%" : `${stats?.overview.errorRate.toFixed(2) || 0}%`}
          className="text-red-600"
        />
      </div>

      {/* Charts */}
      <div className="mb-8">
        <StatsCharts stats={stats} loading={loading} />
      </div>

      {/* Workers List */}
      <Card className="p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Workers</h2>
        {loading ? (
          <p className="text-gray-500">Loading workers...</p>
        ) : (
          <WorkersList stats={stats} />
        )}
      </Card>

      {/* Recent Errors */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Recent Errors</h2>
        <RecentErrors />
      </Card>
    </div>
  );
}
