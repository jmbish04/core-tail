import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../ui/chart";
import { AlertTriangleIcon, ActivityIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

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

// Outcome colors mapped to semantic meaning
const OUTCOME_COLORS: Record<string, string> = {
  ok: "hsl(142, 76%, 46%)",
  exception: "hsl(0, 84%, 60%)",
  canceled: "hsl(45, 93%, 53%)",
  exceededCpu: "hsl(25, 95%, 53%)",
  exceededMemory: "hsl(280, 68%, 60%)",
  responseStreamDisconnected: "hsl(200, 80%, 55%)",
  unknown: "hsl(220, 13%, 46%)",
};

export function StatsCharts({ stats, loading }: Props) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-zinc-800 rounded w-40" />
            </CardHeader>
            <CardContent>
              <div className="h-[250px] bg-zinc-900 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // — Donut chart: outcome distribution —
  const outcomeData = stats.byOutcome.map((item) => ({
    outcome: item.outcome,
    count: item.count,
    fill: OUTCOME_COLORS[item.outcome] || OUTCOME_COLORS.unknown,
  }));

  const outcomeConfig: ChartConfig = {
    count: { label: "Events" },
    ...Object.fromEntries(
      stats.byOutcome.map((item) => [
        item.outcome,
        {
          label: item.outcome.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
          color: OUTCOME_COLORS[item.outcome] || OUTCOME_COLORS.unknown,
        },
      ]),
    ),
  };

  const totalEvents = stats.overview.totalLogs;

  // — Bar chart: per-worker breakdown —
  const workerData = Object.entries(stats.byWorker)
    .map(([workerName, outcomes]) => {
      const errors =
        (outcomes.exception || 0) +
        (outcomes.error || 0) +
        (outcomes.exceededCpu || 0) +
        (outcomes.exceededMemory || 0);
      return {
        worker: workerName.length > 18 ? workerName.substring(0, 18) + "…" : workerName,
        ok: outcomes.ok || 0,
        errors,
        canceled: outcomes.canceled || 0,
        disconnected: outcomes.responseStreamDisconnected || 0,
      };
    })
    .sort((a, b) => (b.ok + b.errors) - (a.ok + a.errors))
    .slice(0, 10);

  const workerConfig: ChartConfig = {
    ok: { label: "Success", color: "hsl(142, 76%, 46%)" },
    errors: { label: "Errors", color: "hsl(0, 84%, 60%)" },
    canceled: { label: "Canceled", color: "hsl(45, 93%, 53%)" },
    disconnected: { label: "Disconnected", color: "hsl(200, 80%, 55%)" },
  };

  // — Radial gauge: error rate —
  const errorRateAngle = Math.min((stats.overview.errorRate / 100) * 360, 360);
  const radialData = [{ errorRate: stats.overview.errorRate, fill: "hsl(0, 84%, 60%)" }];
  const radialConfig: ChartConfig = {
    errorRate: { label: "Error Rate", color: "hsl(0, 84%, 60%)" },
  };

  const isHighError = stats.overview.errorRate > 10;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Donut: Outcome Distribution */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle className="text-foreground">Log Distribution</CardTitle>
          <CardDescription className="text-muted-foreground">By outcome type</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer
            config={outcomeConfig}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={outcomeData}
                dataKey="count"
                nameKey="outcome"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {totalEvents.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            Total Events
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 leading-none font-medium text-foreground">
            <ActivityIcon className="h-4 w-4" />
            {stats.byOutcome.length} outcome types tracked
          </div>
        </CardFooter>
      </Card>

      {/* Bar: Per-Worker Breakdown */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle className="text-foreground">Worker Activity</CardTitle>
          <CardDescription className="text-muted-foreground">
            Top {workerData.length} workers by volume
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={workerConfig} className="mx-auto w-full max-h-[250px]">
            <BarChart accessibilityLayer data={workerData}>
              <CartesianGrid vertical={false} stroke="hsl(240, 4%, 16%)" />
              <XAxis
                dataKey="worker"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tick={{ fill: "hsl(0, 0%, 90%)", fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(0, 0%, 70%)", fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="ok"
                stackId="a"
                fill="var(--color-ok)"
                radius={[0, 0, 4, 4]}
              />
              <Bar
                dataKey="errors"
                stackId="a"
                fill="var(--color-errors)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="canceled"
                stackId="a"
                fill="var(--color-canceled)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="disconnected"
                stackId="a"
                fill="var(--color-disconnected)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 leading-none font-medium text-foreground">
            {Object.keys(stats.byWorker).length} worker{Object.keys(stats.byWorker).length !== 1 ? "s" : ""} reporting
          </div>
        </CardFooter>
      </Card>

      {/* Radial Gauge: Error Rate */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle className="text-foreground">Error Rate</CardTitle>
          <CardDescription className="text-muted-foreground">
            {stats.overview.errorCount.toLocaleString()} of {stats.overview.totalLogs.toLocaleString()} events
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center pb-0">
          <ChartContainer
            config={radialConfig}
            className="mx-auto aspect-square w-full max-w-[250px]"
          >
            <RadialBarChart
              data={radialData}
              startAngle={0}
              endAngle={errorRateAngle}
              innerRadius={80}
              outerRadius={110}
            >
              <PolarGrid
                gridType="circle"
                radialLines={false}
                stroke="none"
                className="first:fill-muted last:fill-background"
                polarRadius={[86, 74]}
              />
              <RadialBar
                dataKey="errorRate"
                background
                cornerRadius={10}
                fill="var(--color-errorRate)"
              />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className={`fill-foreground text-4xl font-bold ${isHighError ? "fill-red-400" : "fill-emerald-400"}`}
                          >
                            {stats.overview.errorRate.toFixed(1)}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground text-sm"
                          >
                            Error Rate
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </PolarRadiusAxis>
            </RadialBarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className={`flex items-center gap-2 leading-none font-medium ${isHighError ? "text-red-400" : "text-emerald-400"}`}>
            {isHighError ? (
              <>
                <AlertTriangleIcon className="h-4 w-4" />
                Above 10% threshold — needs attention
              </>
            ) : (
              <>
                <TrendingDownIcon className="h-4 w-4" />
                Healthy error rate
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
