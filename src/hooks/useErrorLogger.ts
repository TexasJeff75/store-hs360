import { useState, useCallback } from 'react';

export interface ErrorLog {
  id: string;
  message: string;
  context?: string;
  timestamp: Date;
  stack?: string;
}

export function useErrorLogger() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);

  const logError = useCallback((err: unknown, context?: string) => {
    const error = err instanceof Error ? err : new Error(String(err));
    const prefix = context ? `[${context}]` : "[error]";
    console.error(prefix, error);

    const errorLog: ErrorLog = {
      id: Math.random().toString(36).substr(2, 9),
      message: error.message,
      context,
      timestamp: new Date(),
      stack: error.stack
    };

    setErrors(prev => [...prev, errorLog]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return {
    errors,
    logError,
    clearErrors
  };
}