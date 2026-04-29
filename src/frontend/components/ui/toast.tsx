import * as React from "react";
import { CheckCircle2Icon, XCircleIcon, AlertCircleIcon, InfoIcon, XIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
  promptToCopy?: string;
}

interface ToastContextType {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: ToastProps = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration || 3000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastViewport toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function ToastViewport({
  toasts,
  onRemove,
}: {
  toasts: ToastProps[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }: { toast: ToastProps; onRemove: (id: string) => void }) {
  const variantStyles = {
    default: "bg-background border-border",
    success: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    error: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
    warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  };

  const variantIcons = {
    default: InfoIcon,
    success: CheckCircle2Icon,
    error: XCircleIcon,
    warning: AlertCircleIcon,
    info: InfoIcon,
  };

  const variantIconColors = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  const Icon = variantIcons[toast.variant || "default"];

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-5",
        variantStyles[toast.variant || "default"]
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", variantIconColors[toast.variant || "default"])} />
      <div className="flex-1 space-y-1">
        {toast.title && <div className="font-semibold text-sm">{toast.title}</div>}
        {toast.description && <div className="text-sm opacity-90">{toast.description}</div>}
        {toast.promptToCopy && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(toast.promptToCopy!)
                .then(() => {
                  window.dispatchEvent(new CustomEvent('frontend-log', {
                    detail: { level: 'success', title: 'Copied!', message: 'Error details copied to clipboard' }
                  }));
                })
                .catch((err) => {
                  console.error("[Toast] Copy failed:", err);
                  window.dispatchEvent(new CustomEvent('frontend-log', {
                    detail: { level: 'error', title: 'Copy Failed', message: 'Failed to copy to clipboard' }
                  }));
                });
            }}
            className="mt-2 inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-2 text-foreground"
          >
            <CopyIcon className="w-3 h-3 mr-2" />
            Copy for Agent
          </button>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <XIcon className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
}
