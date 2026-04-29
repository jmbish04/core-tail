export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogMessage {
  level: LogLevel;
  title: string;
  message?: string;
  error?: unknown;
  promptContext?: string; // Additional context to copy for the coding agent
}

class FrontendLogger {
  private static instance: FrontendLogger;

  private constructor() {}

  static getInstance(): FrontendLogger {
    if (!FrontendLogger.instance) {
      FrontendLogger.instance = new FrontendLogger();
    }
    return FrontendLogger.instance;
  }

  log(payload: LogMessage) {
    const event = new CustomEvent('frontend-log', { detail: payload });
    
    // Safety check for SSR environment
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }

    // Console logging
    if (payload.level === 'error') {
      console.error(`[Frontend Error] ${payload.title}:`, payload.message, payload.error);
    } else {
      console.log(`[Frontend ${payload.level}] ${payload.title}:`, payload.message);
    }
  }

  error(title: string, error: unknown, promptContext?: string) {
    const message = error instanceof Error ? error.message : String(error);
    const fullError = error instanceof Error && error.stack ? `\n\nStack Trace:\n${error.stack}` : '';
    const fullPrompt = promptContext 
      ? `${promptContext}\n\nError Message: ${message}${fullError}`
      : `Error Message: ${message}${fullError}`;

    this.log({
      level: 'error',
      title,
      error,
      message,
      promptContext: fullPrompt
    });
  }

  success(title: string, message?: string) {
    this.log({
      level: 'success',
      title,
      message
    });
  }

  info(title: string, message?: string) {
    this.log({
      level: 'info',
      title,
      message
    });
  }

  warning(title: string, message?: string) {
    this.log({
      level: 'warning',
      title,
      message
    });
  }
}

export const logger = FrontendLogger.getInstance();
