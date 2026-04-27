import * as React from 'react';

interface LogEntry {
  id: number;
  workerName: string;
  eventTimestamp: string;
  exceptions: any[];
}

export function RecentErrors() {
  const [errors, setErrors] = React.useState<LogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadErrors();
  }, []);

  async function loadErrors() {
    try {
      const res = await fetch('/api/logs?outcome=exception&limit=10');
      const data = await res.json();
      setErrors(data.logs);
    } catch (error) {
      console.error('Error loading recent errors:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading recent errors...</p>;
  }

  if (errors.length === 0) {
    return <p className="text-gray-500">No recent errors</p>;
  }

  return (
    <div className="space-y-4">
      {errors.map((log) => {
        const timestamp = new Date(log.eventTimestamp).toLocaleString();
        const exceptions = log.exceptions || [];
        const firstException = exceptions[0] || {
          name: 'Unknown',
          message: 'No details available',
        };

        return (
          <div key={log.id} className="border-l-4 border-red-500 pl-4 py-2">
            <div className="flex justify-between items-start mb-1">
              <span className="font-semibold">{log.workerName}</span>
              <span className="text-sm text-gray-500">{timestamp}</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {firstException.name}: {firstException.message}
            </p>
            <a
              href={`/worker/${encodeURIComponent(log.workerName)}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View details →
            </a>
          </div>
        );
      })}
    </div>
  );
}
