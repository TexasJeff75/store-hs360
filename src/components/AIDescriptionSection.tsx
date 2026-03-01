import React, { useState } from 'react';
import { Sparkles, Loader, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { Product } from '../services/productService';
import { generateProductDescription, saveGeneratedDescription } from '../services/aiDescriptionService';

interface AIDescriptionSectionProps {
  product: Product;
  isAdmin?: boolean;
  onDescriptionSaved?: () => void;
}

const AIDescriptionSection: React.FC<AIDescriptionSectionProps> = ({
  product,
  isAdmin = false,
  onDescriptionSaved,
}) => {
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSaved(false);
    try {
      const description = await generateProductDescription(product);
      setGeneratedHtml(description);
    } catch (err: any) {
      setError(err.message || 'Failed to generate description');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedHtml) return;
    setSaving(true);
    setError(null);
    try {
      const success = await saveGeneratedDescription(product.id, generatedHtml);
      if (success) {
        setSaved(true);
        onDescriptionSaved?.();
      } else {
        setError('Failed to save description');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save description');
    } finally {
      setSaving(false);
    }
  };

  if (generatedHtml) {
    return (
      <div className="border-t border-gray-200 pt-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-semibold text-gray-800 flex items-center">
            <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
            AI-Generated Description
          </h5>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
            {isAdmin && (
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  saved
                    ? 'text-green-700 bg-green-50 border border-green-200'
                    : 'text-white bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? (
                  <Loader className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1.5" />
                )}
                {saved ? 'Saved' : 'Save to Product'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 mb-3 text-sm text-red-600 bg-red-50 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div
            className="prose prose-sm max-w-none text-gray-700
              prose-headings:text-gray-900 prose-headings:font-semibold prose-headings:text-base prose-headings:mt-4 prose-headings:mb-2
              prose-p:leading-relaxed prose-p:mb-3
              prose-ul:my-2 prose-li:text-gray-600 prose-li:mb-1"
            dangerouslySetInnerHTML={{ __html: generatedHtml }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 pt-5 mt-5">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h5 className="text-sm font-semibold text-gray-900 mb-1">
              AI Product Description
            </h5>
            <p className="text-xs text-gray-600 mb-3">
              Generate a detailed, professional product description including overview, benefits,
              usage instructions, and quality information.
            </p>

            {error && (
              <div className="flex items-center space-x-2 mb-3 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-60 shadow-sm"
            >
              {generating ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Description
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDescriptionSection;
