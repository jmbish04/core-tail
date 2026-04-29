import React, { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { apiFetch } from "@/lib/api";

import { LogsMetrics } from "./LogsMetrics";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface Log {
  id: number;
  workerName: string;
  level: string;
  message: string;
  metadata: string | null;
  timestamp: string;
}

export function LogsDashboard() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [workerName, setWorkerName] = useState<string>("all");
  const [workers, setWorkers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<{ [logId: number]: string }>({});
  const [analyzing, setAnalyzing] = useState<{ [logId: number]: boolean }>({});

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/logs", window.location.origin);
      if (workerName !== "all") {
        url.searchParams.set("workerName", workerName);
      }

      const { ok, data: json } = await apiFetch(url.toString());
      if (ok) {
        const data = Array.isArray(json) ? json : (json.logs || []);
        setLogs(data);

        // Extract unique workers if not already set
        if (workers.length === 0) {
          const uniqueWorkers = Array.from(new Set(data.map((l: any) => l.workerName)));
          setWorkers(uniqueWorkers as string[]);
        }
      }
    } catch (err: any) {
      logger.error(
        "Failed to fetch logs",
        err,
        `## API Error - Logs Dashboard\n\nFailed to fetch logs from /api/logs.\n\nError: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerName]);

  const handleAnalyze = async (log: Log) => {
    setAnalyzing((prev) => ({ ...prev, [log.id]: true }));
    try {
      const { ok, data } = await apiFetch("/api/analysis/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workerName: log.workerName,
          logId: log.id,
          message: log.message,
          metadata: log.metadata,
        }),
      });

      if (ok) {
        setAnalysis((prev) => ({ ...prev, [log.id]: data.analysis }));
      } else {
        setAnalysis((prev) => ({ ...prev, [log.id]: "Analysis failed." }));
      }
    } catch (err: any) {
      logger.error(
        "Analysis Initialization Failed",
        err,
        `## API Error - AI Analysis\n\nFailed to request AI analysis for log entry.\n\nError: ${err.message}`
      );
      setAnalysis((prev) => ({ ...prev, [log.id]: "Failed to initiate analysis." }));
    } finally {
      setAnalyzing((prev) => ({ ...prev, [log.id]: false }));
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Error Distribution</h2>
          <LogsMetrics />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Incoming Logs</h2>
          <div className="w-[200px]">
            <Select value={workerName} onValueChange={setWorkerName}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Worker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-zinc-400">Loading logs...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <TableRow>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.workerName}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${log.level === "error" ? "bg-red-500/10 text-red-500" : "bg-zinc-800 text-zinc-300"}`}
                      >
                        {log.level}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{log.message}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => logger.info("Ask Docs", log.message)}
                      >
                        Ask Docs
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAnalyze(log)}
                        disabled={analyzing[log.id]}
                      >
                        {analyzing[log.id] ? "Analyzing..." : "Analyze & Fix"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {analysis[log.id] && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-zinc-900/50 p-4">
                        <div className="text-sm font-semibold mb-2 text-zinc-300">
                          Agent Analysis:
                        </div>
                        <pre className="whitespace-pre-wrap text-xs bg-black p-4 rounded-md overflow-x-auto border border-zinc-800">
                          {analysis[log.id]}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
