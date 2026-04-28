import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { AlertCircleIcon, CopyIcon, SparklesIcon } from 'lucide-react';
import { ErrorAnalysisModal } from './ErrorAnalysisModal';

interface UniqueError {
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  exampleId: number;
  metadata: any;
}

interface Props {
  workerName?: string;
}

export function WorkerDetail({ workerName }: Props) {
  const [errors, setErrors] = React.useState<UniqueError[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedError, setSelectedError] = React.useState<UniqueError | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = React.useState(false);

  React.useEffect(() => {
    if (!workerName) return;

    fetch(`/api/logs/worker/${workerName}/errors`)
      .then(res => res.json())
      .then(data => {
        setErrors(data.errors || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load errors:', err);
        setLoading(false);
      });
  }, [workerName]);

  const handleAnalyzeError = (error: UniqueError) => {
    setSelectedError(error);
    setShowAnalysisModal(true);
  };

  const copyErrorToClipboard = (error: UniqueError) => {
    navigator.clipboard.writeText(error.message).then(() => {
      alert('Error message copied to clipboard!');
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-gray-500">Loading worker details...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Worker: {workerName}</h1>
          <p className="text-gray-500 mt-2">{errors.length} unique error types found</p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline">
          ← Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unique Errors (by occurrence)</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-gray-500">No errors found for this worker.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error Message</TableHead>
                  <TableHead className="text-center">Occurrences</TableHead>
                  <TableHead>First Seen</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((error, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm max-w-md truncate">
                      <div className="flex items-center gap-2">
                        <AlertCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="truncate" title={error.message}>{error.message}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={error.count > 10 ? 'destructive' : 'secondary'}>
                        {error.count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(error.firstSeen).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(error.lastSeen).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyErrorToClipboard(error)}
                        >
                          <CopyIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAnalyzeError(error)}
                        >
                          <SparklesIcon className="w-4 h-4 mr-2" />
                          Analyze with AI
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showAnalysisModal && selectedError && (
        <ErrorAnalysisModal
          workerName={workerName || ''}
          error={selectedError}
          onClose={() => setShowAnalysisModal(false)}
        />
      )}
    </div>
  );
}
