import React, { useState } from 'react';
import { AlertTriangle, X, Loader } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  entityName: string;
  cascadeWarnings: string[];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isProcessing: boolean;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  entityName,
  cascadeWarnings,
  onConfirm,
  onCancel,
  isProcessing,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setConfirmed(false);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold text-lg">{title}</h3>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{entityName}</strong>?
          </p>

          {cascadeWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">
                The following related records will be affected:
              </p>
              <ul className="text-sm text-amber-700 space-y-1">
                {cascadeWarnings.map((warning, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">&#8226;</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-600">
              I understand this action will mark records as deleted
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isProcessing}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
          >
            {isProcessing && <Loader className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
