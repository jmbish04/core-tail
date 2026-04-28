import { CopyIcon, RefreshCwIcon, WifiIcon, WifiOffIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "./ui/toast";

interface LogEntry {
  id: number;
  workerName: string;
  eventTimestamp: string;
  outcome: string;
  logs: any;
  exceptions: any;
  statusCode?: number;
  requestUrl?: string;
  requestMethod?: string;
}

export function RealtimeLogs() {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [workers, setWorkers] = React.useState<string[]>([]);
  const [selectedWorker, setSelectedWorker] = React.useState<string>("all");
  const [selectedLevel, setSelectedLevel] = React.useState<string>("all");
  const [keyword, setKeyword] = React.useState<string>("");
  const [isConnected, setIsConnected] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string>("");
  const [isReconnecting, setIsReconnecting] = React.useState(false);
  const [isPolling, setIsPolling] = React.useState(false);
  const [ws, setWs] = React.useState<WebSocket | null>(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = React.useState<string | null>(null);
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const { addToast } = useToast();

  // Load workers list
  React.useEffect(() => {
    fetch("/api/logs/workers")
      .then((res) => res.json())
      .then((data) => setWorkers(data.workers || []))
      .catch((err) => console.error("Failed to load workers:", err));
  }, []);

  // Read filters from URL on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workerParam = params.get("worker");
    const levelParam = params.get("level");
    const keywordParam = params.get("keyword");

    if (workerParam) setSelectedWorker(workerParam);
    if (levelParam) setSelectedLevel(levelParam);
    if (keywordParam) setKeyword(keywordParam);
  }, []);

  // Update URL when filters change
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (selectedWorker && selectedWorker !== "all") params.set("worker", selectedWorker);
    if (selectedLevel && selectedLevel !== "all") params.set("level", selectedLevel);
    if (keyword) params.set("keyword", keyword);

    const newUrl = params.toString() ? `?${params.toString()}` : "/realtime";
    window.history.replaceState({}, "", newUrl);
  }, [selectedWorker, selectedLevel, keyword]);

  // Fetch logs from sync API (polling fallback)
  const fetchLogsSync = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (lastSyncTimestamp) {
        params.set("since", lastSyncTimestamp);
      }

      const response = await fetch(`/api/logs/sync?${params.toString()}`);
      const data = await response.json();

      if (data.logs && data.logs.length > 0) {
        setLogs((prev) => {
          // Merge new logs with existing, remove duplicates by id
          const existingIds = new Set(prev.map(l => l.id));
          const newLogs = data.logs.filter((log: LogEntry) => !existingIds.has(log.id));
          return [...newLogs, ...prev].slice(0, 500);
        });
        setLastSyncTimestamp(data.timestamp);
      }
    } catch (error) {
      console.error("Error fetching logs from sync API:", error);
    }
  }, [lastSyncTimestamp]);

  // Start polling fallback
  const startPolling = React.useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setIsPolling(true);
    addToast({
      title: "Polling Mode Active",
      description: "Using fallback polling (updates every 5 seconds)",
      variant: "info",
      duration: 3000,
    });

    // Initial fetch
    fetchLogsSync();

    // Poll every 5 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchLogsSync();
    }, 5000);
  }, [fetchLogsSync, addToast]);

  // Stop polling fallback
  const stopPolling = React.useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // WebSocket connection
  const connectWebSocket = React.useCallback(() => {
    // Stop polling if active
    stopPolling();

    // Close existing connection
    if (ws) {
      ws.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams();
    if (selectedWorker && selectedWorker !== "all") params.set("workerName", selectedWorker);
    if (selectedLevel && selectedLevel !== "all") params.set("level", selectedLevel);
    if (keyword) params.set("keyword", keyword);

    const wsUrl = `${protocol}//${window.location.host}/api/stream/logs?${params.toString()}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setConnectionError("");
      setIsReconnecting(false);
      stopPolling(); // Ensure polling is stopped when WS connects
      addToast({
        title: "Connected",
        description: "Real-time log streaming is active",
        variant: "success",
        duration: 2000,
      });
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "logs" && message.data) {
          setLogs((prev) => [...message.data, ...prev].slice(0, 500)); // Keep last 500 logs
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      const errorMsg = error instanceof ErrorEvent ? error.message : "Connection failed";
      setConnectionError(errorMsg);
      setIsConnected(false);
    };

    websocket.onclose = (event) => {
      console.log("WebSocket disconnected", event.code, event.reason);
      const reason = event.reason || "Connection closed";
      setConnectionError(reason);
      setIsConnected(false);
      setIsReconnecting(false);

      // Start polling fallback when WebSocket disconnects
      if (!isPolling) {
        console.log("WebSocket closed, starting polling fallback");
        startPolling();
      }
    };

    setWs(websocket);
  }, [selectedWorker, selectedLevel, keyword, ws, addToast, stopPolling, startPolling, isPolling]);

  React.useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
      stopPolling(); // Clean up polling on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorker, selectedLevel, keyword]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleReconnect = () => {
    setIsReconnecting(true);
    addToast({
      title: "Reconnecting...",
      description: "Attempting to reestablish connection",
      variant: "info",
      duration: 2000,
    });
    connectWebSocket();
  };

  const copyLogsToClipboard = () => {
    const logsText = logs
      .map((log) => {
        return `[${log.eventTimestamp}] ${log.workerName} - ${log.outcome}\n${JSON.stringify(log.logs, null, 2)}`;
      })
      .join("\n\n");

    navigator.clipboard
      .writeText(logsText)
      .then(() => {
        addToast({
          title: "Copied!",
          description: "Logs copied to clipboard successfully",
          variant: "success",
          duration: 2000,
        });
      })
      .catch((err) => {
        console.error("Failed to copy logs:", err);
        addToast({
          title: "Copy Failed",
          description: "Failed to copy logs to clipboard",
          variant: "error",
          duration: 3000,
        });
      });
  };

  const copyErrorPrompt = () => {
    const prompt = `## WebSocket Connection Error - Core-Tail Real-time Logs

**Issue:** The real-time log streaming page shows "Disconnected" and cannot establish a WebSocket connection.

**Error Details:**
\`\`\`
${connectionError || "WebSocket failed to connect"}
\`\`\`

**WebSocket URL:** ${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/stream/logs

**Request:** Please diagnose and fix the WebSocket connection issue in the Core-Tail worker. The LogStreamer Durable Object may not be properly handling connections or the /api/stream/logs route may have configuration issues.

**Files to check:**
- src/backend/api/routes/stream.ts
- src/backend/do/LogStreamer.ts
- wrangler.jsonc (LOG_STREAMER binding)`;

    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        addToast({
          title: "Copied!",
          description: "Error prompt copied to clipboard - share with your agent",
          variant: "success",
          duration: 3000,
        });
      })
      .catch((err) => {
        console.error("Failed to copy prompt:", err);
        addToast({
          title: "Copy Failed",
          description: "Failed to copy error prompt",
          variant: "error",
          duration: 3000,
        });
      });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      ok: "default",
      exception: "destructive",
      error: "destructive",
      canceled: "secondary",
      exceededCpu: "destructive",
      exceededMemory: "destructive",
    };
    return <Badge variant={variants[outcome] || "secondary"}>{outcome}</Badge>;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Real-time Logs</span>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : isPolling ? "secondary" : "destructive"}>
                {isConnected ? (
                  <>
                    <WifiIcon className="w-3 h-3 mr-1" />
                    Connected
                  </>
                ) : isPolling ? (
                  <>
                    <RefreshCwIcon className="w-3 h-3 mr-1 animate-spin" />
                    Polling Mode
                  </>
                ) : (
                  <>
                    <WifiOffIcon className="w-3 h-3 mr-1" />
                    Disconnected
                  </>
                )}
              </Badge>
              <span className="text-sm text-muted-foreground">{logs.length} logs</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Connection Error Banner */}
          {!isConnected && connectionError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                    Connection Error
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                    {connectionError}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReconnect}
                      variant="outline"
                      size="sm"
                      disabled={isReconnecting}
                      className="border-red-300 dark:border-red-700"
                    >
                      {isReconnecting ? (
                        <>
                          <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                          Reconnecting...
                        </>
                      ) : (
                        <>
                          <WifiIcon className="w-4 h-4 mr-2" />
                          Reconnect
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={copyErrorPrompt}
                      variant="outline"
                      size="sm"
                      className="border-red-300 dark:border-red-700"
                    >
                      <CopyIcon className="w-4 h-4 mr-2" />
                      Copy Error Prompt
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger>
                <SelectValue placeholder="Select worker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map((worker) => (
                  <SelectItem key={worker} value={worker}>
                    {worker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="exception">Exception</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by keyword..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />

            <div className="flex gap-2">
              <Button onClick={copyLogsToClipboard} variant="outline" size="sm">
                <CopyIcon className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button onClick={clearLogs} variant="outline" size="sm">
                <RefreshCwIcon className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-[600px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">Waiting for logs...</div>
            ) : (
              logs.map((log, idx) => (
                <div key={`${log.id}-${idx}`} className="mb-2 border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-500">
                      {new Date(log.eventTimestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-blue-400">{log.workerName}</span>
                    {getOutcomeBadge(log.outcome)}
                    {log.requestMethod && (
                      <span className="text-yellow-400">{log.requestMethod}</span>
                    )}
                  </div>
                  {log.logs && (
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(log.logs, null, 2)}
                    </pre>
                  )}
                  {log.exceptions && (
                    <pre className="text-red-400 text-xs whitespace-pre-wrap">
                      {JSON.stringify(log.exceptions, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
