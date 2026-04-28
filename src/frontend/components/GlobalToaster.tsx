import * as React from "react";
import { ToastProvider, useToast } from "./ui/toast";

function ErrorListener() {
  const { addToast } = useToast();

  React.useEffect(() => {
    const handleLog = (e: any) => {
      const detail = e.detail;
      
      if (detail.level === 'error') {
        addToast({
          title: detail.title,
          description: detail.message,
          promptToCopy: detail.promptContext,
          variant: "error",
          duration: 0 // Keep open until manually closed
        });
      } else if (detail.level === 'success') {
        addToast({
          title: detail.title,
          description: detail.message,
          variant: "success",
          duration: 3000
        });
      } else if (detail.level === 'warning') {
        addToast({
          title: detail.title,
          description: detail.message,
          variant: "warning",
          duration: 4000
        });
      } else {
        addToast({
          title: detail.title,
          description: detail.message,
          variant: "info",
          duration: 3000
        });
      }
    };
    
    window.addEventListener('frontend-log', handleLog);
    return () => window.removeEventListener('frontend-log', handleLog);
  }, [addToast]);

  return null;
}

export function GlobalToaster() {
  return (
    <ToastProvider>
      <ErrorListener />
    </ToastProvider>
  );
}
