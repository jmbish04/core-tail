import * as React from "react";
import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { apiFetch } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Metric {
  workerName: string;
  level: string;
  count: number;
}

export function LogsMetrics() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { ok, data: rawData } = await apiFetch("/api/logs/metrics");
        if (ok) {
          // Format for Recharts: { name: 'worker1', error: 5, info: 10 }
          const formattedData: { [key: string]: any } = {};

          const metricsArray = Array.isArray(rawData) ? rawData : (rawData.metrics || []);
          metricsArray.forEach((m: any) => {
            if (!formattedData[m.workerName]) {
              formattedData[m.workerName] = { name: m.workerName };
            }
            formattedData[m.workerName][m.level] = m.count;
          });

          setData(Object.values(formattedData));
        }
      } catch (err: any) {
        logger.error(
          "Metrics Fetch Failed",
          err,
          `## API Error - Logs Metrics\n\nFailed to fetch logs metrics from /api/logs/metrics.\n\nError: ${err.message}`
        );
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#09090b",
              borderColor: "#27272a",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "#f4f4f5" }}
          />
          <Bar dataKey="error" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="info" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="warning" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
