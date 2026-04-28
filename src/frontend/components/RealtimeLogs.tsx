import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { CopyIcon, RefreshCwIcon } from 'lucide-react';

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
  const [selectedWorker, setSelectedWorker] = React.useState<string>('all');
  const [selectedLevel, setSelectedLevel] = React.useState<string>('all');
  const [keyword, setKeyword] = React.useState<string>('');
  const [isConnected, setIsConnected] = React.useState(false);
  const [ws, setWs] = React.useState<WebSocket | null>(null);
  const logsEndRef = React.useRef<HTMLDivElement>(null);

  // Load workers list
  React.useEffect(() => {
    fetch('/api/logs/workers')
      .then(res => res.json())
      .then(data => setWorkers(data.workers || []))
      .catch(err => console.error('Failed to load workers:', err));
  }, []);

  // Read filters from URL on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workerParam = params.get('worker');
    const levelParam = params.get('level');
    const keywordParam = params.get('keyword');

    if (workerParam) setSelectedWorker(workerParam);
    if (levelParam) setSelectedLevel(levelParam);
    if (keywordParam) setKeyword(keywordParam);
  }, []);

  // Update URL when filters change
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (selectedWorker && selectedWorker !== 'all') params.set('worker', selectedWorker);
    if (selectedLevel && selectedLevel !== 'all') params.set('level', selectedLevel);
    if (keyword) params.set('keyword', keyword);

    const newUrl = params.toString() ? `?${params.toString()}` : '/realtime';
    window.history.replaceState({}, '', newUrl);
  }, [selectedWorker, selectedLevel, keyword]);

  // WebSocket connection
  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams();
    if (selectedWorker && selectedWorker !== 'all') params.set('workerName', selectedWorker);
    if (selectedLevel && selectedLevel !== 'all') params.set('level', selectedLevel);
    if (keyword) params.set('keyword', keyword);

    const wsUrl = `${protocol}//${window.location.host}/api/stream/logs?${params.toString()}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'logs' && message.data) {
          setLogs(prev => [...message.data, ...prev].slice(0, 500)); // Keep last 500 logs
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [selectedWorker, selectedLevel, keyword]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const copyLogsToClipboard = () => {
    const logsText = logs.map(log => {
      return `[${log.eventTimestamp}] ${log.workerName} - ${log.outcome}\n${JSON.stringify(log.logs, null, 2)}`;
    }).join('\n\n');

    navigator.clipboard.writeText(logsText).then(() => {
      alert('Logs copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy logs:', err);
    });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      ok: 'default',
      exception: 'destructive',
      error: 'destructive',
      canceled: 'secondary',
      exceededCpu: 'destructive',
      exceededMemory: 'destructive',
    };
    return <Badge variant={variants[outcome] || 'secondary'}>{outcome}</Badge>;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Real-time Logs</span>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <span className="text-sm text-muted-foreground">{logs.length} logs</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger>
                <SelectValue placeholder="Select worker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map(worker => (
                  <SelectItem key={worker} value={worker}>{worker}</SelectItem>
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
                    <span className="text-gray-500">{new Date(log.eventTimestamp).toLocaleTimeString()}</span>
                    <span className="text-blue-400">{log.workerName}</span>
                    {getOutcomeBadge(log.outcome)}
                    {log.requestMethod && (
                      <span className="text-yellow-400">{log.requestMethod}</span>
                    )}
                  </div>
                  {log.logs && (
                    <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(log.logs, null, 2)}</pre>
                  )}
                  {log.exceptions && (
                    <pre className="text-red-400 text-xs whitespace-pre-wrap">{JSON.stringify(log.exceptions, null, 2)}</pre>
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
