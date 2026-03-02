import React, { useState, useEffect } from 'react';
import { FileText, Plus, Save, X, Loader, Star, Trash2, Edit2, ChevronDown, ChevronRight, GripVertical, AlertCircle } from 'lucide-react';
import { descriptionTemplateService, DescriptionTemplate, TemplateSection } from '@/services/descriptionTemplateService';

const DescriptionTemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<DescriptionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DescriptionTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formSections, setFormSections] = useState<TemplateSection[]>([]);
  const [formSystemPrompt, setFormSystemPrompt] = useState('');
  const [formGuidelines, setFormGuidelines] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    const data = await descriptionTemplateService.getAll();
    setTemplates(data);
    setLoading(false);
  };

  const resetForm = () => {
    const defaults = descriptionTemplateService.getHardcodedDefault();
    setFormName('');
    setFormIsDefault(false);
    setFormSections(defaults.sections);
    setFormSystemPrompt(defaults.system_prompt);
    setFormGuidelines(defaults.guidelines);
  };

  const populateForm = (t: DescriptionTemplate) => {
    setFormName(t.name);
    setFormIsDefault(t.is_default);
    setFormSections([...t.sections]);
    setFormSystemPrompt(t.system_prompt);
    setFormGuidelines(t.guidelines);
  };

  const handleCreate = () => {
    resetForm();
    setEditingTemplate(null);
    setShowCreate(true);
  };

  const handleEdit = (t: DescriptionTemplate) => {
    populateForm(t);
    setEditingTemplate(t);
    setShowCreate(true);
  };

  const handleCancel = () => {
    setShowCreate(false);
    setEditingTemplate(null);
    setPreviewHtml(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      name: formName.trim(),
      is_default: formIsDefault,
      sections: formSections,
      system_prompt: formSystemPrompt,
      guidelines: formGuidelines,
    };

    if (editingTemplate) {
      const success = await descriptionTemplateService.update(editingTemplate.id, payload);
      if (!success) {
        setError('Failed to update template');
        setSaving(false);
        return;
      }
    } else {
      const created = await descriptionTemplateService.create(payload);
      if (!created) {
        setError('Failed to create template');
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowCreate(false);
    setEditingTemplate(null);
    await loadTemplates();
  };

  const handleDelete = async (id: string) => {
    const t = templates.find(t => t.id === id);
    if (t?.is_default) {
      setError('Cannot delete the default template. Set another template as default first.');
      return;
    }
    if (!confirm('Delete this template? This cannot be undone.')) return;
    await descriptionTemplateService.remove(id);
    await loadTemplates();
  };

  const handleSetDefault = async (id: string) => {
    await descriptionTemplateService.setDefault(id);
    await loadTemplates();
  };

  const handleAddSection = () => {
    setFormSections([...formSections, { heading: '', placeholder: '' }]);
  };

  const handleRemoveSection = (index: number) => {
    setFormSections(formSections.filter((_, i) => i !== index));
  };

  const handleSectionChange = (index: number, field: keyof TemplateSection, value: string) => {
    const updated = [...formSections];
    if (field === 'type') {
      updated[index] = { ...updated[index], type: value as 'paragraph' | 'list' };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setFormSections(updated);
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formSections.length) return;
    const updated = [...formSections];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFormSections(updated);
  };

  const handlePreview = () => {
    const html = descriptionTemplateService.buildHtmlFromSections(formSections);
    setPreviewHtml(previewHtml ? null : html);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Description Templates</h2>
            <p className="text-sm text-gray-500">
              {templates.length} template{templates.length !== 1 ? 's' : ''} -- controls AI-generated product descriptions
            </p>
          </div>
        </div>
        {!showCreate && (
          <button
            onClick={handleCreate}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>New Template</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </h3>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Health & Wellness, Sports Nutrition"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Set as default template</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI System Prompt</label>
              <textarea
                value={formSystemPrompt}
                onChange={(e) => setFormSystemPrompt(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Instructions for the AI model's persona and behavior..."
              />
              <p className="mt-1 text-xs text-gray-400">
                Defines the AI's role and expertise when generating descriptions.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Sections ({formSections.length})
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handlePreview}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {previewHtml ? 'Hide Preview' : 'Show Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Section</span>
                  </button>
                </div>
              </div>

              {previewHtml && (
                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">HTML Structure Preview</p>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">{previewHtml}</pre>
                </div>
              )}

              <div className="space-y-3">
                {formSections.map((section, idx) => (
                  <div key={idx} className="flex items-start space-x-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex flex-col items-center space-y-1 pt-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, 'up')}
                        disabled={idx === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3 rotate-180" />
                      </button>
                      <GripVertical className="h-3 w-3 text-gray-300" />
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, 'down')}
                        disabled={idx === formSections.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2">
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          value={section.heading}
                          onChange={(e) => handleSectionChange(idx, 'heading', e.target.value)}
                          placeholder="Section heading"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <select
                          value={section.type || 'paragraph'}
                          onChange={(e) => handleSectionChange(idx, 'type', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="paragraph">Paragraph</option>
                          <option value="list">Bullet List</option>
                        </select>
                      </div>
                      <div className="md:col-span-7">
                        <textarea
                          value={section.placeholder}
                          onChange={(e) => handleSectionChange(idx, 'placeholder', e.target.value)}
                          placeholder="Placeholder / instruction for this section"
                          rows={2}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors mt-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content Guidelines</label>
              <textarea
                value={formGuidelines}
                onChange={(e) => setFormGuidelines(e.target.value)}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Rules and constraints for the generated content..."
              />
              <p className="mt-1 text-xs text-gray-400">
                One guideline per line. These are appended to every AI generation request.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              className="flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {saving && <Loader className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              <span>{editingTemplate ? 'Update' : 'Create'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {templates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm mt-1">Create a template to control AI-generated product descriptions</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map((t) => (
              <div key={t.id} className="hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <button
                      onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === t.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{t.name}</span>
                        {t.is_default && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Star className="h-3 w-3" />
                            <span>Default</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t.sections.length} section{t.sections.length !== 1 ? 's' : ''} -- updated {new Date(t.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {!t.is_default && (
                      <button
                        onClick={() => handleSetDefault(t.id)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(t)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandedId === t.id && (
                  <div className="px-5 pb-4 pl-12 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">System Prompt</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 font-mono whitespace-pre-wrap">{t.system_prompt}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Sections</p>
                      <div className="space-y-1">
                        {t.sections.map((s, i) => (
                          <div key={i} className="flex items-center space-x-3 text-sm">
                            <span className="text-gray-400 w-5 text-right">{i + 1}.</span>
                            <span className="font-medium text-gray-800">{s.heading}</span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {s.type === 'list' ? 'list' : 'paragraph'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Guidelines</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 font-mono whitespace-pre-wrap">{t.guidelines}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DescriptionTemplateManagement;
