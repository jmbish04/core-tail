import {
  CheckCircle2Icon,
  ClockIcon,
  CopyIcon,
  DatabaseIcon,
  FileSearchIcon,
  LoaderIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { logger } from "@/lib/logger";
import { apiFetch } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface Props {
  workerName: string;
  error: {
    message: string;
    count: number;
    exampleId: number;
    metadata: any;
  };
  errorHash: string;
  onClose: () => void;
}

type AnalysisStep =
  | "checking-cache"
  | "fetching-source"
  | "searching-docs"
  | "generating-prompt"
  | "saving"
  | "complete"
  | "error";

const STEP_LABELS: Record<AnalysisStep, { label: string; icon: React.ReactNode }> = {
  "checking-cache": { label: "Checking for cached analysis...", icon: <DatabaseIcon className="w-4 h-4" /> },
  "fetching-source": { label: "Fetching worker source code...", icon: <FileSearchIcon className="w-4 h-4" /> },
  "searching-docs": { label: "Searching Cloudflare documentation...", icon: <SearchIcon className="w-4 h-4" /> },
  "generating-prompt": { label: "Generating fix prompt with AI...", icon: <SparklesIcon className="w-4 h-4" /> },
  saving: { label: "Saving analysis to database...", icon: <DatabaseIcon className="w-4 h-4" /> },
  complete: { label: "Analysis complete", icon: <CheckCircle2Icon className="w-4 h-4" /> },
  error: { label: "Analysis failed", icon: <XIcon className="w-4 h-4" /> },
};

export function ErrorAnalysisModal({ workerName, error, errorHash, onClose }: Props) {
  const [step, setStep] = React.useState<AnalysisStep>("checking-cache");
  const [analysis, setAnalysis] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [cached, setCached] = React.useState(false);
  const [cachedAt, setCachedAt] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    checkCacheAndAnalyze();
  }, []);

  const checkCacheAndAnalyze = async () => {
    setLoading(true);
    setStep("checking-cache");

    try {
      // Step 1: Check D1 cache
      const { ok: lookupOk, data: lookupData } = await apiFetch(
        `/api/analysis/lookup?workerName=${encodeURIComponent(workerName)}&errorHash=${encodeURIComponent(errorHash)}`,
      );

      if (lookupOk && lookupData.exists && lookupData.analysis?.analysisPrompt) {
        setAnalysis(lookupData.analysis.analysisPrompt);
        setCached(true);
        setCachedAt(lookupData.analysis.createdAt || null);
        setStep("complete");
        setLoading(false);
        return;
      }
    } catch (lookupErr) {
      console.error("[ErrorAnalysisModal] Cache lookup failed:", lookupErr);
      // Non-fatal — continue with fresh analysis
    }

    // Step 2: Trigger fresh analysis
    await runAnalysis();
  };

  const runAnalysis = async () => {
    setLoading(true);
    setCached(false);
    setCachedAt(null);

    // Simulate step progression with delays
    setStep("fetching-source");

    try {
      // We can't get granular progress from the agent, but we simulate the stages
      // based on expected timelines
      const stepTimer = setTimeout(() => setStep("searching-docs"), 3000);
      const stepTimer2 = setTimeout(() => setStep("generating-prompt"), 6000);
      const stepTimer3 = setTimeout(() => setStep("saving"), 15000);

      const { ok, data: result } = await apiFetch("/api/analysis/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workerName,
          logId: error.exampleId,
          message: error.message,
          metadata: error.metadata ? JSON.stringify(error.metadata) : null,
          errorHash,
        }),
      });

      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      if (!ok) {
        throw new Error(result.error || "Analysis failed");
      }

      setAnalysis(result.analysis || "No analysis available");
      setCached(result.cached || false);
      setStep("complete");
    } catch (err) {
      console.error("[ErrorAnalysisModal] Error analyzing:", err);
      logger.error("Analysis Failed", err, `## AI Analysis Error\n\nFailed to analyze error for worker: ${workerName}`);
      setAnalysis("Failed to analyze error. Please try again.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(analysis)
      .then(() => {
        setCopied(true);
        logger.success("Copied!", "Fix prompt copied to clipboard — paste it into your coding agent");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("[ErrorAnalysisModal] Copy failed:", err);
        logger.error("Copy Failed", err, "Failed to copy analysis to clipboard");
      });
  };

  const currentStep = STEP_LABELS[step];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <SparklesIcon className="w-5 h-5 text-blue-400" />
              AI Error Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Worker: <span className="font-mono text-foreground">{workerName}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Error Summary */}
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Error Message</div>
            <div className="font-mono text-sm text-foreground whitespace-pre-wrap break-words max-h-[120px] overflow-y-auto">
              {error.message}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <Badge variant="secondary" className="text-xs">
                {error.count} occurrence{error.count !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Log #{error.exampleId}
              </Badge>
            </div>
          </div>

          {/* Progress Indicator */}
          {loading && (
            <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <LoaderIcon className="w-4 h-4 animate-spin text-blue-400" />
              <div className="flex items-center gap-2 text-sm text-blue-400">
                {currentStep.icon}
                <span>{currentStep.label}</span>
              </div>
            </div>
          )}

          {/* Cached indicator */}
          {cached && !loading && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <DatabaseIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">
                Loaded from cache
                {cachedAt && (
                  <span className="text-muted-foreground ml-1">
                    — saved {new Date(cachedAt).toLocaleString()}
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-xs h-7"
                onClick={runAnalysis}
              >
                <RefreshCwIcon className="w-3 h-3 mr-1" />
                Re-analyze
              </Button>
            </div>
          )}

          {/* Analysis Result */}
          {analysis && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-blue-400" />
                  AI-Generated Fix Prompt
                </h3>
                <Button
                  size="sm"
                  variant={copied ? "default" : "outline"}
                  onClick={copyToClipboard}
                  className={copied ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                >
                  {copied ? (
                    <>
                      <CheckCircle2Icon className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-4 h-4 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-foreground whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed">
                {analysis}
              </div>

              <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                Copy this prompt and provide it to your coding agent (Cursor, Copilot, Claude) to implement the fix.
              </p>
            </div>
          )}

          {/* Error state */}
          {step === "error" && !loading && (
            <div className="text-center py-6 space-y-3">
              <p className="text-red-400">Analysis failed. Please try again.</p>
              <Button variant="outline" onClick={runAnalysis}>
                <RefreshCwIcon className="w-4 h-4 mr-2" />
                Retry Analysis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
