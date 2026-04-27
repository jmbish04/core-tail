import * as React from "react";

import { Card } from "../ui/card";
import { LogFilters } from "./LogFilters";
import { LogsTable } from "./LogsTable";
import { WorkerStats } from "./WorkerStats";

interface WorkerDetailProps {
  workerName: string;
}

export function WorkerDetail({ workerName }: WorkerDetailProps) {
  const [outcomeFilter, setOutcomeFilter] = React.useState("");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <a href="/dashboard" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Dashboard
        </a>
        <h1 className="text-4xl font-bold">{workerName}</h1>
      </div>

      {/* Worker Stats */}
      <div className="mb-8">
        <WorkerStats workerName={workerName} />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <LogFilters onApply={setOutcomeFilter} />
      </div>

      {/* Logs Table */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Logs</h2>
        <LogsTable workerName={workerName} outcomeFilter={outcomeFilter} />
      </Card>
    </div>
  );
}
