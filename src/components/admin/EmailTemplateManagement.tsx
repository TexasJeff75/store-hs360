import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, Save, Loader, AlertCircle, CheckCircle, Eye, EyeOff, ToggleLeft, ToggleRight, RotateCcw, Info, Bold, Italic, Link, Type, List, Code, Image, AlignLeft, AlignCenter } from 'lucide-react';
import { emailTemplateService, type EmailTemplate } from '@/services/emailTemplateService';
import { useAuth } from '@/contexts/AuthContext';

const EMAIL_WRAPPER_HEAD = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #ec4899, #f97316); padding: 32px 24px; text-align: center;">
      <img src="/Logo_web.webp" alt="HealthSpan360" width="48" height="48" style="display:block;margin:0 auto 12px auto;border-radius:8px;" />
      <h1 style="color: white; font-size: 24px; margin: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 700;">HealthSpan360</h1>
      <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Turning Insight Into Impact</p>
    </div>
    <div style="padding: 32px 24px;">`;

const EMAIL_WRAPPER_TAIL = `    </div>
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        HealthSpan360 &bull; This is an automated message. Please do not reply directly.
      </p>
    </div>
  </div>
</body>
</html>`;

function renderPreview(bodyHtml: string, variables: EmailTemplate['variables']): string {
  let html = bodyHtml;
  for (const v of variables) {
    if (v.example) {
      html = html.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.example);
    }
  }
  html = html.replace(/\{\{\w+\}\}/g, '');
  return `${EMAIL_WRAPPER_HEAD}${html}${EMAIL_WRAPPER_TAIL}`;
}

// ── HTML Editor Toolbar ──

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  action: (textarea: HTMLTextAreaElement, value: string, setValue: (v: string) => void) => void;
  separator?: boolean;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  before: string,
  after: string,
  placeholder: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end) || placeholder;
  const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
  setValue(newValue);
  requestAnimationFrame(() => {
    textarea.focus();
    const newCursorStart = start + before.length;
    const newCursorEnd = newCursorStart + selected.length;
    textarea.setSelectionRange(newCursorStart, newCursorEnd);
  });
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  text: string,
) {
  const start = textarea.selectionStart;
  const newValue = value.slice(0, start) + text + value.slice(start);
  setValue(newValue);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + text.length, start + text.length);
  });
}

const toolbarActions: ToolbarAction[] = [
  {
    icon: <Bold className="h-3.5 w-3.5" />,
    label: 'Bold',
    action: (ta, val, set) =>
      wrapSelection(ta, val, set, '<strong>', '</strong>', 'bold text'),
  },
  {
    icon: <Italic className="h-3.5 w-3.5" />,
    label: 'Italic',
    action: (ta, val, set) =>
      wrapSelection(ta, val, set, '<em>', '</em>', 'italic text'),
  },
  {
    icon: <Link className="h-3.5 w-3.5" />,
    label: 'Link',
    action: (ta, val, set) => {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = val.slice(start, end) || 'Link text';
      const snippet = `<a href="#" style="color:#ec4899;text-decoration:underline;">${selected}</a>`;
      const newVal = val.slice(0, start) + snippet + val.slice(end);
      set(newVal);
    },
  },
  {
    icon: <Type className="h-3.5 w-3.5" />,
    label: 'Heading',
    action: (ta, val, set) =>
      wrapSelection(ta, val, set, '<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">', '</h2>', 'Heading'),
  },
  {
    icon: <AlignLeft className="h-3.5 w-3.5" />,
    label: 'Paragraph',
    action: (ta, val, set) =>
      wrapSelection(ta, val, set, '<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">', '</p>', 'Paragraph text'),
    separator: true,
  },
  {
    icon: <AlignCenter className="h-3.5 w-3.5" />,
    label: 'Button',
    action: (ta, val, set) =>
      insertAtCursor(ta, val, set, '<div style="text-align:center;margin:24px 0;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#f97316);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Button Text</a></div>'),
  },
  {
    icon: <Image className="h-3.5 w-3.5" />,
    label: 'Info Box',
    action: (ta, val, set) =>
      insertAtCursor(ta, val, set, '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">\n  <p style="color:#1e40af;font-size:14px;margin:0;">Info content here</p>\n</div>'),
  },
  {
    icon: <List className="h-3.5 w-3.5" />,
    label: 'Item Row',
    action: (ta, val, set) =>
      insertAtCursor(ta, val, set, '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f3f4f6;">\n  <div style="flex:1;">\n    <div style="font-size:14px;font-weight:500;color:#111827;">Item Name</div>\n    <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Qty: 1</div>\n  </div>\n  <div style="font-size:14px;font-weight:600;color:#111827;">$0.00</div>\n</div>'),
  },
  {
    icon: <Code className="h-3.5 w-3.5" />,
    label: 'Variable',
    action: (ta, val, set) =>
      wrapSelection(ta, val, set, '{{', '}}', 'variable_name'),
  },
];

const EmailTemplateManagement: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await emailTemplateService.getAll();
    if (err) {
      setError(err);
    } else {
      setTemplates(data);
      if (!selected && data.length > 0) {
        selectTemplate(data[0]);
      }
    }
    setLoading(false);
  };

  const selectTemplate = (t: EmailTemplate) => {
    setSelected(t);
    setEditSubject(t.subject_template);
    setEditBody(t.body_html);
    setShowPreview(false);
  };

  const hasChanges = selected && (editSubject !== selected.subject_template || editBody !== selected.body_html);

  const handleSave = async () => {
    if (!selected || !hasChanges) return;
    setSaving(true);
    setError(null);
    const { success: ok, error: err } = await emailTemplateService.update(
      selected.id,
      { subject_template: editSubject, body_html: editBody },
      user?.id,
    );
    if (err) {
      setError(err);
    } else if (ok) {
      setSuccess('Template saved successfully');
      await loadTemplates();
      const updated = templates.find(t => t.id === selected.id);
      if (updated) selectTemplate({ ...updated, subject_template: editSubject, body_html: editBody });
    }
    setSaving(false);
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    const { error: err } = await emailTemplateService.update(
      template.id,
      { is_active: !template.is_active },
      user?.id,
    );
    if (err) {
      setError(err);
    } else {
      await loadTemplates();
    }
  };

  const handleRevert = () => {
    if (!selected) return;
    setEditSubject(selected.subject_template);
    setEditBody(selected.body_html);
  };

  const handleToolbarAction = useCallback((action: ToolbarAction['action']) => {
    if (!textareaRef.current) return;
    action(textareaRef.current, editBody, setEditBody);
  }, [editBody]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-yellow-800 font-medium">No email templates found</p>
          <p className="text-yellow-600 text-sm mt-1">
            Run the email_templates migration to seed the default templates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Templates</h2>
        <p className="text-gray-600">Manage notification email content and layout</p>
      </div>

      {/* Status messages */}
      {error && (
        <div className="mb-4 flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-700">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template list */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Templates</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selected?.id === t.id
                      ? 'bg-gradient-to-r from-pink-50 to-orange-50 border-l-2 border-l-pink-500'
                      : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${selected?.id === t.id ? 'text-pink-700' : 'text-gray-700'}`}>
                      {t.name}
                    </span>
                    {!t.is_active && (
                      <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Off</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{t.email_type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editor */}
        {selected && (
          <div className="lg:col-span-3 space-y-4">
            {/* Template header bar */}
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
              <div>
                <h3 className="font-semibold text-gray-900">{selected.name}</h3>
                <span className="text-xs text-gray-400 font-mono">{selected.email_type}</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleToggleActive(selected)}
                  className="flex items-center space-x-1.5 text-sm"
                  title={selected.is_active ? 'Disable template (will use hardcoded fallback)' : 'Enable template'}
                >
                  {selected.is_active ? (
                    <>
                      <ToggleRight className="h-5 w-5 text-green-500" />
                      <span className="text-green-700">Active</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-500">Inactive</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Template</label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Body editor with toolbar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Body HTML</label>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>{showPreview ? 'Editor' : 'Preview'}</span>
                </button>
              </div>

              {showPreview ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                  <iframe
                    srcDoc={renderPreview(editBody, selected.variables)}
                    className="w-full border-0"
                    style={{ height: '500px' }}
                    title="Email preview"
                    sandbox=""
                  />
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-pink-500 focus-within:border-transparent">
                  {/* Toolbar */}
                  <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                    {toolbarActions.map((action, idx) => (
                      <React.Fragment key={action.label}>
                        <button
                          type="button"
                          onClick={() => handleToolbarAction(action.action)}
                          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                          title={action.label}
                        >
                          {action.icon}
                        </button>
                        {action.separator && idx < toolbarActions.length - 1 && (
                          <div className="w-px h-5 bg-gray-300 mx-1" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={20}
                    className="w-full px-3 py-2 text-sm font-mono leading-relaxed border-0 focus:ring-0 focus:outline-none resize-y"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {/* Variables reference */}
            {selected.variables.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-800">Available Variables</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selected.variables.map((v) => (
                    <div key={v.key} className="text-sm">
                      <code className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-mono">
                        {'{{' + v.key + '}}'}
                      </code>
                      <span className="text-blue-600 ml-2">{v.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-pink-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Changes</span>
              </button>
              <button
                onClick={handleRevert}
                disabled={!hasChanges}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Revert</span>
              </button>
            </div>

            {/* Last updated */}
            {selected.updated_at && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(selected.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplateManagement;
