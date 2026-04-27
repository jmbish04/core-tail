/**
 * @fileoverview Cloudflare TraceEvent types
 *
 * Type definitions for Cloudflare Workers tail events telemetry.
 */

export interface TraceEvent {
  scriptName: string;
  outcome: 'ok' | 'exception' | 'exceededCpu' | 'exceededMemory' | 'unknown' | 'canceled';
  eventTimestamp: number; // Unix ms
  event: {
    request?: {
      url: string;
      method: string;
      headers: Record<string, string>;
    };
    response?: {
      status: number;
    };
  };
  logs?: TraceLog[];
  exceptions?: TraceException[];
  diagnosticsChannelEvents?: TraceDiagnosticsChannelEvent[];
}

export interface TraceLog {
  level: 'log' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface TraceException {
  name: string;
  message: string;
  timestamp: number;
}

export interface TraceDiagnosticsChannelEvent {
  channel: string;
  message: any;
  timestamp: number;
}

export interface TailEvent {
  events: TraceEvent[];
}
