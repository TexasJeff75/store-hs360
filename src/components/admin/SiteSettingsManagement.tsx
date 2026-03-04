import React, { useState, useEffect } from 'react';
import { Settings, Save, Loader, AlertCircle, CheckCircle, Truck, Phone, Shield, RefreshCw } from 'lucide-react';
import { siteSettingsService } from '@/services/siteSettings';

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  category: string;
  label: string;
  description: string;
}

interface EditState {
  [key: string]: string;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  shipping: { label: 'Shipping', icon: <Truck className="h-5 w-5" />, color: 'text-blue-600' },
  contact: { label: 'Contact Information', icon: <Phone className="h-5 w-5" />, color: 'text-emerald-600' },
  security: { label: 'Security', icon: <Shield className="h-5 w-5" />, color: 'text-amber-600' },
};

const SiteSettingsManagement: React.FC = () => {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [editState, setEditState] = useState<EditState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await siteSettingsService.getAllSettingsRaw();
      if (data.length === 0) {
        setTableExists(false);
      } else {
        setTableExists(true);
        setSettings(data);
        const initialEdit: EditState = {};
        data.forEach(s => {
          initialEdit[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        });
        setEditState(initialEdit);
      }
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, originalValue: unknown) => {
    const rawInput = editState[key];
    if (rawInput === undefined) return;

    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(rawInput);
    } catch {
      parsedValue = rawInput;
    }

    const originalStr = typeof originalValue === 'string' ? originalValue : JSON.stringify(originalValue);
    const newStr = typeof parsedValue === 'string' ? parsedValue : JSON.stringify(parsedValue);
    if (originalStr === newStr) return;

    setSaving(key);
    setError(null);

    const ok = await siteSettingsService.updateSetting(key, parsedValue);
    if (ok) {
      setSuccess(`"${key}" updated successfully`);
      await loadSettings();
    } else {
      setError(`Failed to update "${key}"`);
    }

    setSaving(null);
  };

  const handleSaveAll = async () => {
    setSaving('all');
    setError(null);
    let allOk = true;

    for (const setting of settings) {
      const rawInput = editState[setting.key];
      if (rawInput === undefined) continue;

      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(rawInput);
      } catch {
        parsedValue = rawInput;
      }

      const originalStr = typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value);
      const newStr = typeof parsedValue === 'string' ? parsedValue : JSON.stringify(parsedValue);
      if (originalStr === newStr) continue;

      const ok = await siteSettingsService.updateSetting(setting.key, parsedValue);
      if (!ok) allOk = false;
    }

    if (allOk) {
      setSuccess('All settings saved');
      await loadSettings();
    } else {
      setError('Some settings failed to save');
    }

    setSaving(null);
  };

  const grouped = settings.reduce<Record<string, SettingRow[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!tableExists) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Site Settings</h2>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-2">Settings Table Not Found</h3>
              <p className="text-amber-800 text-sm mb-4">
                The <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">site_settings</code> table
                has not been created yet. Apply the database migration to enable configurable settings.
              </p>
              <p className="text-amber-700 text-sm">
                Until the migration is applied, the app will use default values for shipping rates,
                contact information, and session timeouts.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Current Defaults</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Shipping Rates</h4>
              <div className="grid grid-cols-3 gap-3">
                {siteSettingsService.getDefaults().shipping.map(m => (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                    <p className="text-lg font-bold text-gray-900">${m.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{m.days}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Contact</h4>
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 space-y-1">
                <p>{siteSettingsService.getDefaults().contact.phone}</p>
                <p>{siteSettingsService.getDefaults().contact.email}</p>
                <p>{siteSettingsService.getDefaults().contact.addressLine1}</p>
                <p>{siteSettingsService.getDefaults().contact.addressLine2}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Security</h4>
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                Session timeout: {siteSettingsService.getDefaults().sessionTimeoutMinutes} minutes
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Site Settings</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSettings}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving !== null}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving === 'all' ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(grouped).map(([category, categorySettings]) => {
          const config = categoryConfig[category] || {
            label: category.charAt(0).toUpperCase() + category.slice(1),
            icon: <Settings className="h-5 w-5" />,
            color: 'text-gray-600',
          };

          return (
            <div key={category} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
                <span className={config.color}>{config.icon}</span>
                <h3 className="font-semibold text-gray-900">{config.label}</h3>
              </div>

              <div className="divide-y divide-gray-100">
                {categorySettings.map((setting) => {
                  const isNumber = typeof setting.value === 'number';
                  const isSaving = saving === setting.key;

                  return (
                    <div key={setting.key} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <label className="block text-sm font-medium text-gray-900 mb-0.5">
                            {setting.label}
                          </label>
                          {setting.description && (
                            <p className="text-xs text-gray-500 mb-2">{setting.description}</p>
                          )}
                          <div className="flex items-center gap-2">
                            {isNumber ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editState[setting.key] ?? ''}
                                onChange={(e) => setEditState(prev => ({ ...prev, [setting.key]: e.target.value }))}
                                className="w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            ) : (
                              <input
                                type="text"
                                value={editState[setting.key] ?? ''}
                                onChange={(e) => setEditState(prev => ({ ...prev, [setting.key]: e.target.value }))}
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            )}
                            <button
                              onClick={() => handleSave(setting.key, setting.value)}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              {isSaving ? <Loader className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SiteSettingsManagement;
