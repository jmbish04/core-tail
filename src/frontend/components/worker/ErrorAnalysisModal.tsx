import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CopyIcon, LoaderIcon, SparklesIcon, XIcon } from 'lucide-react';

interface Props {
  workerName: string;
  error: {
    message: string;
    count: number;
    exampleId: number;
    metadata: any;
  };
  onClose: () => void;
}

export function ErrorAnalysisModal({ workerName, error, onClose }: Props) {
  const [status, setStatus] = React.useState<string>('idle');
  const [analysis, setAnalysis] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Start analysis automatically when modal opens
    analyzeError();
  }, []);

  const analyzeError = async () => {
    setLoading(true);
    setStatus('Initializing AI analysis...');

    try {
      const response = await fetch('/api/analysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerName,
          logId: error.exampleId,
          message: error.message,
          metadata: error.metadata ? JSON.stringify(error.metadata) : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      setAnalysis(result.analysis || 'No analysis available');
      setStatus('Analysis complete');
    } catch (err) {
      console.error('Error analyzing:', err);
      setAnalysis('Failed to analyze error. Please try again.');
      setStatus('Error');
    } finally {
      setLoading(false);
    }
  };

  const copyAnalysisToClipboard = () => {
    navigator.clipboard.writeText(analysis).then(() => {
      alert('Analysis copied to clipboard!');
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5" />
              AI Error Analysis
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Analyzing error for worker: <span className="font-mono">{workerName}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {/* Error Details */}
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded">
            <div className="text-sm font-semibold mb-2">Error Message:</div>
            <div className="font-mono text-sm">{error.message}</div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>Occurrences: <Badge variant="secondary">{error.count}</Badge></span>
            </div>
          </div>

          {/* Status */}
          {loading && (
            <div className="flex items-center gap-2 mb-4 text-blue-600">
              <LoaderIcon className="w-4 h-4 animate-spin" />
              <span>{status}</span>
            </div>
          )}

          {/* Analysis Result */}
          {analysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">AI-Generated Fix Prompt</h3>
                <Button size="sm" variant="outline" onClick={copyAnalysisToClipboard}>
                  <CopyIcon className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded font-mono text-sm whitespace-pre-wrap">
                {analysis}
              </div>
              <div className="text-xs text-gray-500 italic">
                Copy this prompt and provide it to your coding agent to implement the fix.
              </div>
            </div>
          )}

          {!loading && !analysis && (
            <div className="text-center text-gray-500 py-8">
              Click "Analyze with AI" to get a detailed fix suggestion.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
