import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mail, Save, Loader, AlertCircle, CheckCircle, ToggleLeft, ToggleRight,
  RotateCcw, Info, Bold, Italic, Underline, Link, Type, List, Code, Image,
  AlignLeft, AlignCenter, AlignRight, Minus, Square, Palette,
  ChevronDown, ChevronRight, Settings, Eye, FileCode,
} from 'lucide-react';
import { emailTemplateService, type EmailTemplate } from '@/services/emailTemplateService';
import { emailSettingsService, type EmailSettings } from '@/services/emailSettingsService';
import { useAuth } from '@/contexts/AuthContext';

// ── Preview rendering ──

function buildFullPreview(headerHtml: string, bodyHtml: string, footerHtml: string, variables: EmailTemplate['variables']): string {
  let html = bodyHtml;
  for (const v of variables) {
    if (v.example) {
      html = html.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.example);
    }
  }
  html = html.replace(/\{\{\w+\}\}/g, '');

  // Mirror the table-based layout used in send-email.cjs for accurate preview
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" bgcolor="#f3f4f6">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6;" bgcolor="#f3f4f6">
    <tr>
      <td align="center" style="padding:24px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;" bgcolor="#ffffff">
          <tr>
            <td>${headerHtml}</td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              ${html}
            </td>
          </tr>
          <tr>
            <td>${footerHtml}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── HTML Editor helpers ──

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
    const cs = start + before.length;
    textarea.setSelectionRange(cs, cs + selected.length);
  });
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  text: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const newValue = value.slice(0, start) + text + value.slice(end);
  setValue(newValue);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + text.length, start + text.length);
  });
}

// ── Toolbar definition ──

interface ToolbarItem {
  icon: React.ReactNode;
  label: string;
  action: (ta: HTMLTextAreaElement, val: string, set: (v: string) => void) => void;
  group: string;
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  // Text formatting
  { group: 'format', icon: <Bold className="h-3.5 w-3.5" />, label: 'Bold',
    action: (ta, v, s) => wrapSelection(ta, v, s, '<strong>', '</strong>', 'bold text') },
  { group: 'format', icon: <Italic className="h-3.5 w-3.5" />, label: 'Italic',
    action: (ta, v, s) => wrapSelection(ta, v, s, '<em>', '</em>', 'italic text') },
  { group: 'format', icon: <Underline className="h-3.5 w-3.5" />, label: 'Underline',
    action: (ta, v, s) => wrapSelection(ta, v, s, '<u>', '</u>', 'underlined text') },
  { group: 'format', icon: <Link className="h-3.5 w-3.5" />, label: 'Link',
    action: (ta, v, s) => {
      const sel = v.slice(ta.selectionStart, ta.selectionEnd) || 'Link text';
      const snippet = `<a href="#" style="color:#ec4899;text-decoration:underline;">${sel}</a>`;
      const nv = v.slice(0, ta.selectionStart) + snippet + v.slice(ta.selectionEnd);
      s(nv);
    }},

  // Block elements
  { group: 'block', icon: <Type className="h-3.5 w-3.5" />, label: 'Heading',
    action: (ta, v, s) => wrapSelection(ta, v, s,
      '<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">', '</h2>', 'Heading') },
  { group: 'block', icon: <AlignLeft className="h-3.5 w-3.5" />, label: 'Paragraph',
    action: (ta, v, s) => wrapSelection(ta, v, s,
      '<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">', '</p>', 'Paragraph text') },
  { group: 'block', icon: <Type className="h-3 w-3" />, label: 'Small Text',
    action: (ta, v, s) => wrapSelection(ta, v, s,
      '<p style="color:#9ca3af;font-size:12px;margin:0 0 12px 0;">', '</p>', 'Small text') },

  // Alignment
  { group: 'align', icon: <AlignCenter className="h-3.5 w-3.5" />, label: 'Center',
    action: (ta, v, s) => wrapSelection(ta, v, s,
      '<div style="text-align:center;">', '</div>', 'centered content') },
  { group: 'align', icon: <AlignRight className="h-3.5 w-3.5" />, label: 'Right Align',
    action: (ta, v, s) => wrapSelection(ta, v, s,
      '<div style="text-align:right;">', '</div>', 'right-aligned content') },

  // Components
  { group: 'component', icon: <Square className="h-3.5 w-3.5" />, label: 'Button',
    action: (ta, v, s) => insertAtCursor(ta, v, s,
      '<div style="text-align:center;margin:24px 0;">\n  <!--[if mso]>\n  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="#" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="18%" strokecolor="#ec4899" fillcolor="#ec4899">\n    <w:anchorlock/>\n    <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Button Text</center>\n  </v:roundrect>\n  <![endif]-->\n  <!--[if !mso]><!-->\n  <a href="#" style="display:inline-block;background-color:#ec4899;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Button Text</a>\n  <!--<![endif]-->\n</div>') },
  { group: 'component', icon: <Image className="h-3.5 w-3.5" />, label: 'Info Box',
    action: (ta, v, s) => insertAtCursor(ta, v, s,
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">\n  <p style="color:#1e40af;font-size:14px;margin:0;">Info content here</p>\n</div>') },
  { group: 'component', icon: <Palette className="h-3.5 w-3.5" />, label: 'Success Box',
    action: (ta, v, s) => insertAtCursor(ta, v, s,
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">\n  <p style="color:#166534;font-size:14px;margin:0;">Success content here</p>\n</div>') },
  { group: 'component', icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Warning Box',
    action: (ta, v, s) => insertAtCursor(ta, v, s,
      '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">\n  <p style="color:#991b1b;font-size:14px;margin:0;">Warning content here</p>\n</div>') },
  { group: 'component', icon: <List className="h-3.5 w-3.5" />, label: 'Item Card',
    action: (ta, v, s) => insertAtCursor(ta, v, s,
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-bottom:1px solid #f3f4f6;">\n  <tr>\n    <td style="padding:12px 0;">\n      <div style="font-size:14px;font-weight:500;color:#111827;">Item Name</div>\n      <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Qty: 1</div>\n    </td>\n    <td style="padding:12px 0;text-align:right;white-space:nowrap;">\n      <div style="font-size:14px;font-weight:600;color:#111827;">$0.00</div>\n    </td>\n  </tr>\n</table>') },
  { group: 'component', icon: <Minus className="h-3.5 w-3.5" />, label: 'Divider',
    action: (ta, v, s) => insertAtCursor(ta, v, s,
      '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />') },

  // Variables
  { group: 'variable', icon: <Code className="h-3.5 w-3.5" />, label: 'Variable',
    action: (ta, v, s) => wrapSelection(ta, v, s, '{{', '}}', 'variable_name') },
];

// Group labels for the toolbar
const GROUP_ORDER = ['format', 'block', 'align', 'component', 'variable'];

// ── Reusable HTML Editor ──

interface HtmlEditorProps {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  showToolbar?: boolean;
}

const HtmlEditor: React.FC<HtmlEditorProps> = ({ value, onChange, rows = 14, placeholder, showToolbar = true }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleAction = useCallback((action: ToolbarItem['action']) => {
    if (!ref.current) return;
    action(ref.current, value, onChange);
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = ref.current;
    if (!ta) return;

    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      insertAtCursor(ta, value, onChange, '  ');
    }

    // Auto-close tags on >
    if (e.key === '>' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const before = value.slice(0, ta.selectionStart) + '>';
      const tagMatch = before.match(/<(\w+)[^>]*>$/);
      if (tagMatch) {
        const tagName = tagMatch[1];
        const selfClosing = ['br', 'hr', 'img', 'input', 'meta', 'link'];
        if (!selfClosing.includes(tagName.toLowerCase())) {
          e.preventDefault();
          const closeTag = `</${tagName}>`;
          const pos = ta.selectionStart + 1;
          const nv = value.slice(0, ta.selectionStart) + '>' + closeTag + value.slice(ta.selectionEnd);
          onChange(nv);
          requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(pos, pos);
          });
        }
      }
    }
  }, [value, onChange]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-pink-500 focus-within:border-transparent bg-white">
      {showToolbar && (
        <div className="flex items-center flex-wrap px-2 py-1.5 bg-gray-50 border-b border-gray-200 gap-px">
          {GROUP_ORDER.map((group, gi) => {
            const items = TOOLBAR_ITEMS.filter(t => t.group === group);
            if (items.length === 0) return null;
            return (
              <React.Fragment key={group}>
                {gi > 0 && <div className="w-px h-5 bg-gray-300 mx-1.5" />}
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleAction(item.action)}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                    title={item.label}
                  >
                    {item.icon}
                  </button>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm font-mono leading-relaxed border-0 focus:ring-0 focus:outline-none resize-y bg-white"
        spellCheck={false}
      />
    </div>
  );
};

// ── Main Component ──

const EmailTemplateManagement: React.FC = () => {
  const { user } = useAuth();

  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  // Global settings state
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [editHeader, setEditHeader] = useState('');
  const [editFooter, setEditFooter] = useState('');
  const [showWrapperEditor, setShowWrapperEditor] = useState(false);
  const [activeWrapperTab, setActiveWrapperTab] = useState<'header' | 'footer'>('header');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    const [templatesResult, settingsResult] = await Promise.all([
      emailTemplateService.getAll(),
      emailSettingsService.get(),
    ]);

    if (templatesResult.error) setError(templatesResult.error);
    else {
      setTemplates(templatesResult.data);
      if (!selected && templatesResult.data.length > 0) {
        selectTemplate(templatesResult.data[0]);
      }
    }

    setSettings(settingsResult.data);
    setEditHeader(settingsResult.data.header_html);
    setEditFooter(settingsResult.data.footer_html);

    setLoading(false);
  };

  const selectTemplate = (t: EmailTemplate) => {
    setSelected(t);
    setEditSubject(t.subject_template);
    setEditBody(t.body_html);
  };

  const hasTemplateChanges = selected && (editSubject !== selected.subject_template || editBody !== selected.body_html);
  const hasSettingsChanges = settings && (editHeader !== settings.header_html || editFooter !== settings.footer_html);

  const handleSaveTemplate = async () => {
    if (!selected || !hasTemplateChanges) return;
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
      setSuccess('Template saved');
      await loadAll();
      const updated = templates.find(t => t.id === selected.id);
      if (updated) selectTemplate({ ...updated, subject_template: editSubject, body_html: editBody });
    }
    setSaving(false);
  };

  const handleSaveSettings = async () => {
    if (!hasSettingsChanges) return;
    setSavingSettings(true);
    setError(null);
    const { success: ok, error: err } = await emailSettingsService.update(
      { header_html: editHeader, footer_html: editFooter },
      user?.id,
    );
    if (err) {
      setError(err);
    } else if (ok) {
      setSuccess('Email header & footer saved');
      await loadAll();
    }
    setSavingSettings(false);
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    const { error: err } = await emailTemplateService.update(
      template.id,
      { is_active: !template.is_active },
      user?.id,
    );
    if (err) setError(err);
    else await loadAll();
  };

  const handleRevertTemplate = () => {
    if (!selected) return;
    setEditSubject(selected.subject_template);
    setEditBody(selected.body_html);
  };

  const handleRevertSettings = () => {
    if (!settings) return;
    setEditHeader(settings.header_html);
    setEditFooter(settings.footer_html);
  };

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
      {/* Page header */}
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

      {/* Global header/footer editor (collapsible) */}
      <div className="mb-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowWrapperEditor(!showWrapperEditor)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Email Header & Footer</span>
            {hasSettingsChanges && (
              <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Unsaved</span>
            )}
          </div>
          {showWrapperEditor
            ? <ChevronDown className="h-4 w-4 text-gray-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />
          }
        </button>

        {showWrapperEditor && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <p className="text-xs text-gray-500">
              These wrap every outgoing email. Changes here affect all templates.
            </p>

            {/* Header / Footer tabs */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveWrapperTab('header')}
                className={`flex-1 text-sm py-1.5 px-3 rounded-md transition-colors ${
                  activeWrapperTab === 'header'
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Header
              </button>
              <button
                onClick={() => setActiveWrapperTab('footer')}
                className={`flex-1 text-sm py-1.5 px-3 rounded-md transition-colors ${
                  activeWrapperTab === 'footer'
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Footer
              </button>
            </div>

            {activeWrapperTab === 'header' ? (
              <HtmlEditor value={editHeader} onChange={setEditHeader} rows={8} showToolbar={false} placeholder="Email header HTML..." />
            ) : (
              <HtmlEditor value={editFooter} onChange={setEditFooter} rows={6} showToolbar={false} placeholder="Email footer HTML..." />
            )}

            <div className="flex items-center space-x-3">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings || !hasSettingsChanges}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-pink-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingSettings ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save Header & Footer</span>
              </button>
              <button
                onClick={handleRevertSettings}
                disabled={!hasSettingsChanges}
                className="flex items-center space-x-2 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Revert</span>
              </button>
            </div>
          </div>
        )}
      </div>

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

        {/* Editor + Preview */}
        {selected && (
          <div className="lg:col-span-3 space-y-4">
            {/* Template name bar */}
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
              <div>
                <h3 className="font-semibold text-gray-900">{selected.name}</h3>
                <span className="text-xs text-gray-400 font-mono">{selected.email_type}</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleToggleActive(selected)}
                  className="flex items-center space-x-1.5 text-sm"
                  title={selected.is_active ? 'Disable template' : 'Enable template'}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Body HTML editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body HTML</label>
              <HtmlEditor value={editBody} onChange={setEditBody} rows={14} />
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
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSaveTemplate}
                disabled={saving || !hasTemplateChanges}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-pink-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Template</span>
              </button>
              <button
                onClick={handleRevertTemplate}
                disabled={!hasTemplateChanges}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Revert</span>
              </button>
            </div>

            {selected.updated_at && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(selected.updated_at).toLocaleString()}
              </p>
            )}

            {/* Live preview with code toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Preview</label>
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-gray-300 hover:bg-gray-50"
                >
                  {showCode ? (
                    <>
                      <Eye className="h-3.5 w-3.5 text-gray-600" />
                      <span className="text-gray-700">Preview</span>
                    </>
                  ) : (
                    <>
                      <FileCode className="h-3.5 w-3.5 text-gray-600" />
                      <span className="text-gray-700">View Code</span>
                    </>
                  )}
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                {showCode ? (
                  <pre className="p-4 text-xs font-mono text-gray-800 bg-gray-50 overflow-auto whitespace-pre-wrap break-words" style={{ maxHeight: '600px' }}>
                    {buildFullPreview(editHeader, editBody, editFooter, selected.variables)}
                  </pre>
                ) : (
                  <iframe
                    srcDoc={buildFullPreview(editHeader, editBody, editFooter, selected.variables)}
                    className="w-full border-0"
                    style={{ height: '600px' }}
                    title="Email preview"
                    sandbox=""
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplateManagement;
