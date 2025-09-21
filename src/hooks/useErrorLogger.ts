import { useCallback } from "react";

export function useErrorLogger() {
  return useCallback((err: unknown, context?: string) => {
    const e = err instanceof Error ? err : new Error(String(err));
    const prefix = context ? `[${context}]` : "[error]";
    console.error(prefix, e);
  }, []);
}