import React, { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react';

interface ErrorLog {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  type: 'error' | 'warning' | 'info';
  source?: string;
}

interface ErrorDebugPanelProps {
  errors: ErrorLog[];
  onClearErrors: () => void;
}

const ErrorDebugPanel: React.FC<ErrorDebugPanelProps> = ({ errors, onClearErrors }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getErrorBgColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-red-500 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-b border-red-200">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="font-semibold text-red-700">
            Debug Panel ({errors.length} error{errors.length !== 1 ? 's' : ''})
          </span>
          <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
            DEV ONLY
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onClearErrors}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            title="Clear all errors"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-red-100 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-red-600" />
            ) : (
              <ChevronUp className="h-4 w-4 text-red-600" />
            )}
          </button>
        </div>
      </div>

      {/* Error List */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto">
          {errors.map((error) => (
            <div key={error.id} className={`border-b border-gray-200 ${getErrorBgColor(error.type)}`}>
              <div
                className="p-3 cursor-pointer hover:bg-opacity-75 transition-colors"
                onClick={() => setSelectedError(selectedError === error.id ? null : error.id)}
              >
                <div className="flex items-start space-x-3">
                  {getErrorIcon(error.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {error.message}
                      </p>
                      <div className="flex items-center space-x-2 ml-2">
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(error.timestamp)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(`${error.message}\n${error.stack || ''}`);
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="Copy error"
                        >
                          <Copy className="h-3 w-3 text-gray-500" />
                        </button>
                      </div>
                    </div>
                    {error.source && (
                      <p className="text-xs text-gray-600 mt-1">
                        Source: {error.source}
                      </p>
                    )}
                  </div>
                </div>

                {/* Expanded Error Details */}
                {selectedError === error.id && error.stack && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <pre className="text-xs text-gray-700 bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed Preview */}
      {!isExpanded && errors.length > 0 && (
        <div className="px-4 py-2 bg-red-25">
          <div className="flex items-center space-x-2">
            {getErrorIcon(errors[errors.length - 1].type)}
            <span className="text-sm text-red-700 truncate">
              Latest: {errors[errors.length - 1].message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorDebugPanel;