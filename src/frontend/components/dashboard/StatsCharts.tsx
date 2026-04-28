import * as React from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface DashboardStats {
  overview: {
    totalLogs: number;
    errorCount: number;
    errorRate: number;
  };
  byOutcome: Array<{ outcome: string; count: number }>;
  byWorker: Record<string, Record<string, number>>;
}

interface Props {
  stats: DashboardStats | null;
  loading: boolean;
}

const COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];

export function StatsCharts({ stats, loading }: Props) {
  if (loading || !stats) {
    return <div className="text-gray-500">Loading charts...</div>;
  }

  // Prepare data for outcome pie chart
  const outcomeData = stats.byOutcome.map((item) => ({
    name: item.outcome,
    value: item.count,
  }));

  // Prepare data for worker bar chart
  const workerData = Object.entries(stats.byWorker)
    .map(([workerName, outcomes]) => {
      const total = Object.values(outcomes).reduce((sum, count) => sum + count, 0);
      const errors =
        (outcomes.exception || 0) +
        (outcomes.error || 0) +
        (outcomes.exceededCpu || 0) +
        (outcomes.exceededMemory || 0);
      return {
        name: workerName.length > 20 ? workerName.substring(0, 20) + "..." : workerName,
        total,
        errors,
        ok: outcomes.ok || 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // Top 10 workers

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Outcome Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Log Distribution by Outcome</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={outcomeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {outcomeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Worker Activity Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Workers by Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="ok" stackId="a" fill="#22c55e" name="Success" />
              <Bar dataKey="errors" stackId="a" fill="#ef4444" name="Errors" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Error Rate Trend (placeholder for future time-series data) */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Error Rate Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {stats.overview.totalLogs.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total Logs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {stats.overview.errorCount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Error Count</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {stats.overview.errorRate.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-500">Error Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
