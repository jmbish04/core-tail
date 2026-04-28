import * as React from "react";

interface WorkersListProps {
  stats: any;
}

export function WorkersList({ stats }: WorkersListProps) {
  const [workers, setWorkers] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadWorkers();
  }, []);

  async function loadWorkers() {
    try {
      const res = await fetch("/api/logs/workers");
      const data = await res.json();
      setWorkers(data.workers);
    } catch (error) {
      console.error("Error loading workers:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading workers...</p>;
  }

  if (workers.length === 0) {
    return <p className="text-gray-500">No workers found</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {workers.map((worker) => {
        const workerStats = stats?.byWorker?.[worker] || {};
        const total = Object.values(workerStats).reduce(
          (sum: number, count: any) => sum + count,
          0,
        );
        const errors =
          (workerStats.exception || 0) +
          (workerStats.exceededCpu || 0) +
          (workerStats.exceededMemory || 0);

        return (
          <a
            key={worker}
            href={`/worker/${encodeURIComponent(worker)}`}
            className="block p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <h3 className="font-semibold mb-2">{worker}</h3>
            <div className="text-sm text-gray-500">
              <p>Total: {total}</p>
              <p className="text-red-600">Errors: {errors}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
