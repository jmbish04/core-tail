import * as React from "react";

import { Card } from "../ui/card";

interface LogEntry {
  id: number;
  eventTimestamp: string;
  outcome: string;
  statusCode: number | null;
  requestMethod: string | null;
  requestUrl: string | null;
  logs: any[] | null;
  exceptions: any[] | null;
}

interface LogsTableProps {
  workerName: string;
  outcomeFilter: string;
}

export function LogsTable({ workerName, outcomeFilter }: LogsTableProps) {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedLog, setSelectedLog] = React.useState<LogEntry | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const pageSize = 50;
  const [currentPage, setCurrentPage] = React.useState(0);

  React.useEffect(() => {
    loadLogs();
  }, [workerName, outcomeFilter]);

  async function loadLogs() {
    const params = new URLSearchParams({
      workerName,
      limit: pageSize.toString(),
      offset: (currentPage * pageSize).toString(),
    });

    if (outcomeFilter) {
      params.append("outcome", outcomeFilter);
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs);
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function showLogDetails(logId: number) {
    try {
      const res = await fetch(`/api/logs/${logId}`);
      const data = await res.json();
      setSelectedLog(data.log);
      setShowModal(true);
    } catch (error) {
      console.error("Error loading log details:", error);
    }
  }

  if (loading) {
    return <p className="text-center py-8 text-gray-500">Loading logs...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-center py-8 text-gray-500">No logs found</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">Timestamp</th>
              <th className="text-left py-3 px-4">Outcome</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Method</th>
              <th className="text-left py-3 px-4">URL</th>
              <th className="text-left py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const timestamp = new Date(log.eventTimestamp).toLocaleString();
              const outcomeColor = log.outcome === "ok" ? "text-green-600" : "text-red-600";

              return (
                <tr key={log.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="py-3 px-4 text-sm">{timestamp}</td>
                  <td className="py-3 px-4">
                    <span className={`${outcomeColor} font-medium`}>{log.outcome}</span>
                  </td>
                  <td className="py-3 px-4">{log.statusCode || "-"}</td>
                  <td className="py-3 px-4">{log.requestMethod || "-"}</td>
                  <td className="py-3 px-4 max-w-xs truncate">{log.requestUrl || "-"}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => showLogDetails(log.id)}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold">Log Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">Timestamp</h4>
                <p>{new Date(selectedLog.eventTimestamp).toLocaleString()}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Outcome</h4>
                <p>{selectedLog.outcome}</p>
              </div>
              {selectedLog.requestUrl && (
                <div>
                  <h4 className="font-semibold mb-1">Request</h4>
                  <p>
                    {selectedLog.requestMethod} {selectedLog.requestUrl}
                  </p>
                  <p>Status: {selectedLog.statusCode || "N/A"}</p>
                </div>
              )}
              {selectedLog.logs && selectedLog.logs.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1">Logs</h4>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto text-sm">
                    {JSON.stringify(selectedLog.logs, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.exceptions && selectedLog.exceptions.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1">Exceptions</h4>
                  <pre className="bg-red-50 dark:bg-red-900 p-4 rounded overflow-auto text-sm">
                    {JSON.stringify(selectedLog.exceptions, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
