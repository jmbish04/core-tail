import * as React from "react";
import { logger } from "@/lib/logger";
import { apiFetch } from "@/lib/api";
import { ActivityIcon, AlertTriangleIcon, PercentIcon, ServerIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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
      const { ok, status, data } = await apiFetch<DashboardStats>("/api/logs/stats");
      if (!ok) {
        console.error("[Dashboard] Failed to load stats, status:", status);
        logger.error(
          "Failed to load dashboard stats",
          (data as any).error || "Server returned " + status,
          `## API Error - Dashboard Stats\n\n**Endpoint:** /api/logs/stats\n**Status:** ${status}`
        );
        return;
      }
      setStats(data);
    } catch (error) {
      console.error("[Dashboard] Network error:", error);
      logger.error(
        "Network Error",
        error,
        `## Dashboard Load Error\n\nFailed to fetch dashboard stats from /api/logs/stats.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <h1 className="text-4xl font-bold text-foreground">Worker Logs Dashboard</h1>

      {/* Global Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Logs"
          value={loading || !stats?.overview ? "—" : stats.overview.totalLogs.toLocaleString()}
          icon={<ActivityIcon className="h-4 w-4" />}
        />
        <StatsCard
          title="Error Count"
          value={loading || !stats?.overview ? "—" : stats.overview.errorCount.toLocaleString()}
          className="text-red-400"
          icon={<AlertTriangleIcon className="h-4 w-4" />}
        />
        <StatsCard
          title="Error Rate"
          value={loading || !stats?.overview ? "—%" : `${stats.overview.errorRate?.toFixed(2) || 0}%`}
          className={
            stats?.overview?.errorRate && stats.overview.errorRate > 10
              ? "text-red-400"
              : "text-emerald-400"
          }
          icon={<PercentIcon className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <StatsCharts stats={stats} loading={loading} />

      {/* Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ServerIcon className="h-5 w-5" />
            Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-4">Loading workers...</p>
          ) : (
            <WorkersList stats={stats} />
          )}
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangleIcon className="h-5 w-5 text-red-400" />
            Recent Errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecentErrors />
        </CardContent>
      </Card>
    </div>
  );
}
