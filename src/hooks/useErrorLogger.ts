import { useState, useCallback, useEffect } from 'react';

interface ErrorLog {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  type: 'error' | 'warning' | 'info';
  source?: string;
}

export const useErrorLogger = () => {
  const [errors, setErrors] = useState<ErrorLog[]>([]);

  const logError = useCallback((
    message: string, 
    error?: Error, 
    type: 'error' | 'warning' | 'info' = 'error',
    source?: string
  ) => {
    const errorLog: ErrorLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      message,
      stack: error?.stack,
      type,
      source
    };

    setErrors(prev => [...prev, errorLog]);
    
    // Also log to console for development
    if (type === 'error') {
      console.error(message, error);
    } else if (type === 'warning') {
      console.warn(message, error);
    } else {
      console.info(message, error);
    }
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logError(
        event.message || 'Unknown error occurred',
        event.error,
        'error',
        event.filename ? `${event.filename}:${event.lineno}` : undefined
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError(
        `Unhandled Promise Rejection: ${event.reason}`,
        event.reason instanceof Error ? event.reason : undefined,
        'error',
        'Promise'
      );
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [logError]);

  return {
    errors,
    logError,
    clearErrors
  };
};