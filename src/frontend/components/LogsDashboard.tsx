import React, { useState, useEffect } from "react";

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

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${process.env.WEBHOOK_SECRET || "secret"}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as Log[];
        setLogs(data);

        // Extract unique workers if not already set
        if (workers.length === 0) {
          const uniqueWorkers = Array.from(new Set(data.map((l) => l.workerName)));
          setWorkers(uniqueWorkers);
        }
      }
    } catch (err) {
      console.error("Failed to fetch logs", err);
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
      const res = await fetch("/api/analysis/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WEBHOOK_SECRET || "secret"}`,
        },
        body: JSON.stringify({
          workerName: log.workerName,
          logId: log.id,
          message: log.message,
          metadata: log.metadata,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { analysis: string };
        setAnalysis((prev) => ({ ...prev, [log.id]: data.analysis }));
      } else {
        setAnalysis((prev) => ({ ...prev, [log.id]: "Analysis failed." }));
      }
    } catch (err) {
      console.error("Analysis error", err);
      setAnalysis((prev) => ({ ...prev, [log.id]: "Analysis failed." }));
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
                        onClick={() => window.alert("Asking Docs: " + log.message)}
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
