import * as React from "react";

import { Card } from "../ui/card";

interface LogFiltersProps {
  onApply: (outcome: string) => void;
}

export function LogFilters({ onApply }: LogFiltersProps) {
  const [outcome, setOutcome] = React.useState("");

  const handleApply = () => {
    onApply(outcome);
  };

  return (
    <Card className="p-6">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label htmlFor="outcome-filter" className="block text-sm font-medium mb-2">
            Filter by Outcome
          </label>
          <select
            id="outcome-filter"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800"
          >
            <option value="">All</option>
            <option value="ok">OK</option>
            <option value="exception">Exception</option>
            <option value="canceled">Canceled</option>
            <option value="exceededCpu">Exceeded CPU</option>
            <option value="exceededMemory">Exceeded Memory</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Apply
        </button>
      </div>
    </Card>
  );
}
