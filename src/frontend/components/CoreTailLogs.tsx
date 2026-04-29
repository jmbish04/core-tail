import { CopyIcon, RefreshCwIcon, WifiIcon, WifiOffIcon } from "lucide-react";
import * as React from "react";
import { apiFetch } from "@/lib/api";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "./ui/toast";

interface CoreTailLogEntry {
  id: number;
  workerName: string;
  level: string;
  message: string;
  timestamp: string;
  metadata?: any;
}

export function CoreTailLogs() {
  const [logs, setLogs] = React.useState<CoreTailLogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = React.useState<string>("all");
  const [keyword, setKeyword] = React.useState<string>("");
  const [isConnected, setIsConnected] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string>("");
  const [isReconnecting, setIsReconnecting] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [useWebSocket, setUseWebSocket] = React.useState(true);
  const [ws, setWs] = React.useState<WebSocket | null>(null);
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  // WebSocket connection
  const connectWebSocket = React.useCallback(() => {
    if (!useWebSocket) return;

    // Close existing connection
    if (ws) {
      ws.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams();
    params.set("workerName", "core-tail");
    if (selectedLevel && selectedLevel !== "all") params.set("level", selectedLevel);
    if (keyword) params.set("keyword", keyword);

    const wsUrl = `${protocol}//${window.location.host}/api/stream/logs?${params.toString()}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("WebSocket connected for core-tail logs");
      setIsConnected(true);
      setConnectionError("");
      setIsReconnecting(false);
      addToast({
        title: "Connected",
        description: "Real-time streaming of core-tail logs is active",
        variant: "success",
        duration: 2000,
      });
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "logs" && message.data) {
          setLogs((prev) => [...message.data, ...prev].slice(0, 500));
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      const errorMsg = "WebSocket connection failed - falling back to manual refresh";
      setConnectionError(errorMsg);
      setIsConnected(false);
      setUseWebSocket(false);

      addToast({
        title: "Connection Failed",
        description: "Switched to manual refresh mode. Click refresh to update logs.",
        variant: "warning",
        duration: 5000,
      });
    };

    websocket.onclose = (event) => {
      console.log("WebSocket disconnected", event.code, event.reason);
      setIsConnected(false);
      setIsReconnecting(false);
    };

    setWs(websocket);
  }, [selectedLevel, keyword, ws, addToast, useWebSocket]);

  // Fetch logs via REST API
  const fetchLogs = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.set("workerName", "core-tail");
      if (selectedLevel && selectedLevel !== "all") params.set("level", selectedLevel);
      if (keyword) params.set("keyword", keyword);
      params.set("limit", "100");

      const { ok, data } = await apiFetch(`/api/logs?${params.toString()}`);
      if (!ok) {
        throw new Error(`HTTP Error: Server returned a non-OK response`);
      }
      setLogs(data.logs || []);

      addToast({
        title: "Refreshed",
        description: `Loaded ${data.logs?.length || 0} log entries`,
        variant: "success",
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      addToast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Failed to load logs",
        variant: "error",
        duration: 3000,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedLevel, keyword, addToast]);

  // Initial setup
  React.useEffect(() => {
    if (useWebSocket) {
      connectWebSocket();
    } else {
      fetchLogs();
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel, keyword, useWebSocket]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleReconnect = () => {
    setIsReconnecting(true);
    setUseWebSocket(true);
    addToast({
      title: "Reconnecting...",
      description: "Attempting to reestablish WebSocket connection",
      variant: "info",
      duration: 2000,
    });
    connectWebSocket();
  };

  const handleRefresh = () => {
    if (useWebSocket && isConnected) {
      addToast({
        title: "Already Connected",
        description: "Real-time streaming is active. Logs update automatically.",
        variant: "info",
        duration: 2000,
      });
    } else {
      fetchLogs();
    }
  };

  const copyLogsToClipboard = () => {
    const logsText = logs
      .map((log) => {
        return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
      })
      .join("\n");

    navigator.clipboard
      .writeText(logsText)
      .then(() => {
        addToast({
          title: "Copied!",
          description: `${logs.length} log entries copied to clipboard`,
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

  const clearLogs = () => {
    setLogs([]);
    addToast({
      title: "Cleared",
      description: "Log display cleared",
      variant: "info",
      duration: 2000,
    });
  };

  const getLevelBadge = (level: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      error: "destructive",
      warn: "secondary",
      info: "default",
      debug: "secondary",
    };
    return <Badge variant={variants[level.toLowerCase()] || "default"}>{level}</Badge>;
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-4 h-[calc(100vh-var(--header-height)-var(--footer-height))]">
      <Card className="flex flex-col flex-1 min-h-0">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Core-Tail Worker Logs</span>
            <div className="flex items-center gap-2">
              {useWebSocket ? (
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? (
                    <>
                      <WifiIcon className="w-3 h-3 mr-1" />
                      Real-time
                    </>
                  ) : (
                    <>
                      <WifiOffIcon className="w-3 h-3 mr-1" />
                      Disconnected
                    </>
                  )}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  Manual Refresh
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">{logs.length} logs</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0">
          {/* Connection Error Banner */}
          {!isConnected && connectionError && useWebSocket && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                    WebSocket Unavailable
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                    Real-time streaming is not available. Using manual refresh mode instead.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReconnect}
                      variant="outline"
                      size="sm"
                      disabled={isReconnecting}
                      className="border-yellow-300 dark:border-yellow-700"
                    >
                      {isReconnecting ? (
                        <>
                          <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                          Reconnecting...
                        </>
                      ) : (
                        <>
                          <WifiIcon className="w-4 h-4 mr-2" />
                          Try WebSocket Again
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by keyword..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />

            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={isRefreshing}
              >
                <RefreshCwIcon className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={copyLogsToClipboard} variant="outline" size="sm">
                <CopyIcon className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button onClick={clearLogs} variant="outline" size="sm">
                Clear
              </Button>
            </div>
          </div>

          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm flex-1 min-h-0 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">
                {useWebSocket && isConnected
                  ? "Waiting for logs..."
                  : "Click Refresh to load logs"}
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={`${log.id}-${idx}`} className="mb-2 border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {getLevelBadge(log.level)}
                    <span className="text-blue-400">{log.workerName}</span>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap text-gray-300">
                    {log.message}
                  </pre>
                  {log.metadata && (
                    <pre className="text-xs whitespace-pre-wrap text-gray-500 mt-1">
                      {JSON.stringify(log.metadata, null, 2)}
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
