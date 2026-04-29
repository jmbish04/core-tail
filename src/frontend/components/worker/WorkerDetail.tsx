import { AlertCircleIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon, SparklesIcon } from "lucide-react";
import * as React from "react";
import { logger } from "@/lib/logger";
import { apiFetch } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ErrorAnalysisModal } from "./ErrorAnalysisModal";

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

/**
 * Generate a deterministic hash of a string using SubtleCrypto SHA-256.
 * Falls back to a simple hash if crypto is unavailable.
 */
async function hashErrorMessage(message: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(
      message
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, "[TIMESTAMP]")
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[UUID]")
        .replace(/\d+/g, "[NUMBER]"),
    );
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback: simple string hash
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

export function WorkerDetail({ workerName }: Props) {
  const [errors, setErrors] = React.useState<UniqueError[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedError, setSelectedError] = React.useState<UniqueError | null>(null);
  const [selectedErrorHash, setSelectedErrorHash] = React.useState<string>("");
  const [showAnalysisModal, setShowAnalysisModal] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (!workerName) return;

    const loadErrors = async () => {
      try {
        const { data } = await apiFetch(`/api/logs/worker/${workerName}/errors`);
        setErrors(data.errors || []);
      } catch (err: any) {
        console.error("[WorkerDetail] Failed to load errors:", err);
        logger.error(
          "Failed to load errors",
          err,
          `## API Error - Worker Detail\n\nFailed to load errors for worker: ${workerName}.\n\nError: ${err.message}`,
        );
      } finally {
        setLoading(false);
      }
    };
    loadErrors();
  }, [workerName]);

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleAnalyzeError = async (error: UniqueError) => {
    const hash = await hashErrorMessage(error.message);
    setSelectedError(error);
    setSelectedErrorHash(hash);
    setShowAnalysisModal(true);
  };

  const copyErrorToClipboard = (error: UniqueError) => {
    navigator.clipboard
      .writeText(error.message)
      .then(() => {
        logger.success("Copied!", "Error message copied to clipboard");
      })
      .catch((err) => {
        console.error("[WorkerDetail] Copy failed:", err);
        logger.error("Copy Failed", err, "Failed to copy error message to clipboard");
      });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-muted-foreground">Loading worker details...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Worker: {workerName}</h1>
          <p className="text-muted-foreground mt-2">
            {errors.length} unique error type{errors.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline">
          ← Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Unique Errors (by occurrence)</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-muted-foreground">No errors found for this worker.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-foreground font-semibold">Error Message</TableHead>
                  <TableHead className="text-foreground font-semibold text-center">Occurrences</TableHead>
                  <TableHead className="text-foreground font-semibold">First Seen</TableHead>
                  <TableHead className="text-foreground font-semibold">Last Seen</TableHead>
                  <TableHead className="text-foreground font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((error, idx) => {
                  const isExpanded = expandedRows.has(idx);
                  return (
                    <React.Fragment key={idx}>
                      {/* Main row */}
                      <TableRow
                        className="cursor-pointer hover:bg-zinc-900/50 transition-colors"
                        onClick={() => toggleRow(idx)}
                      >
                        <TableCell className="w-8 pr-0">
                          {isExpanded ? (
                            <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm max-w-md">
                          <div className="flex items-center gap-2">
                            <AlertCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span className={isExpanded ? "" : "truncate"} title={error.message}>
                              {isExpanded ? error.message : error.message.length > 120 ? error.message.substring(0, 120) + "…" : error.message}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={error.count > 10 ? "destructive" : "secondary"}>
                            {error.count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(error.firstSeen).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(error.lastSeen).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => copyErrorToClipboard(error)}>
                              <CopyIcon className="w-4 h-4" />
                            </Button>
                            <Button size="sm" onClick={() => handleAnalyzeError(error)}>
                              <SparklesIcon className="w-4 h-4 mr-2" />
                              Analyze with AI
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <TableRow className="bg-zinc-950/50 hover:bg-zinc-950/50">
                          <TableCell colSpan={6} className="p-0">
                            <div className="px-6 py-4 space-y-3 border-l-2 border-red-500/50 ml-4">
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                  Full Error Message
                                </div>
                                <pre className="font-mono text-sm text-foreground whitespace-pre-wrap break-words bg-zinc-900 rounded-md p-3 max-h-[300px] overflow-y-auto">
                                  {error.message}
                                </pre>
                              </div>

                              {error.metadata && (
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                    Metadata
                                  </div>
                                  <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words bg-zinc-900 rounded-md p-3 max-h-[200px] overflow-y-auto">
                                    {typeof error.metadata === "string"
                                      ? error.metadata
                                      : JSON.stringify(error.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                <Badge variant="outline" className="text-xs">
                                  Example Log ID: {error.exampleId}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {error.count} occurrence{error.count !== 1 ? "s" : ""}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showAnalysisModal && selectedError && (
        <ErrorAnalysisModal
          workerName={workerName || ""}
          error={selectedError}
          errorHash={selectedErrorHash}
          onClose={() => setShowAnalysisModal(false)}
        />
      )}
    </div>
  );
}
