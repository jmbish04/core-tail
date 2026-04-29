/**
 * @fileoverview Agent type definitions for the LogAnalyzerAgent
 */

/** Persistent state for the LogAnalyzerAgent Durable Object */
export type AgentState = {
  analysis: string | null;
  status: "idle" | "analyzing" | "complete" | "error";
  lastAnalyzedWorker: string | null;
  lastAnalyzedAt: string | null;
};

/** Request body for the /analyze endpoint */
export type AnalyzeRequest = {
  workerName: string;
  logId: number;
  message: string;
  metadata: string | null;
  errorHash?: string;
};

/** Result from fetching a worker script */
export type WorkerScriptResult = {
  success: boolean;
  content: string;
  error?: string;
};

/** Result from fetching worker logs */
export type WorkerLogsResult = {
  success: boolean;
  logs: WorkerLogEntry[];
  error?: string;
};

/** A single log entry from the Cloudflare observability API */
export type WorkerLogEntry = {
  message: string;
  level: string;
  timestamp: string;
  scriptName?: string;
  outcome?: string;
};

/** Result from a Cloudflare docs search */
export type DocsSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

/** Full analysis context assembled from all methods */
export type AnalysisContext = {
  workerName: string;
  errorMessage: string;
  metadata: string | null;
  sourceCode: string;
  recentLogs: WorkerLogEntry[];
  relevantDocs: DocsSearchResult[];
};

/** Final analysis output from the agent */
export type AnalysisOutput = {
  summary: string;
  rootCause: string;
  fixPrompt: string;
  relevantDocs: DocsSearchResult[];
};
