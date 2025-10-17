import { useState, useEffect } from 'react';
import { featureFlags, FeatureFlags, ProviderConfig } from '../lib/featureFlags';
import { Settings, Download, Upload, RotateCcw, Save, AlertCircle } from 'lucide-react';

export default function FeatureFlagsAdmin() {
  const [flags, setFlags] = useState<FeatureFlags>(featureFlags.getAllFlags());
  const [config, setConfig] = useState<ProviderConfig>(featureFlags.getConfig());
  const [showImportExport, setShowImportExport] = useState(false);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    Object.keys(flags).forEach(key => {
      const unsubscribe = featureFlags.subscribe(key as keyof FeatureFlags, (enabled) => {
        setFlags(prev => ({ ...prev, [key]: enabled }));
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const handleToggle = (flag: keyof FeatureFlags) => {
    featureFlags.toggle(flag);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all feature flags and provider configuration to defaults?')) {
      featureFlags.reset();
      setFlags(featureFlags.getAllFlags());
      setConfig(featureFlags.getConfig());
      showMessage('success', 'Configuration reset to defaults');
    }
  };

  const handleExport = () => {
    const configJson = featureFlags.exportConfig();
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feature-flags-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('success', 'Configuration exported successfully');
  };

  const handleImport = () => {
    try {
      const success = featureFlags.importConfig(importText);
      if (success) {
        setFlags(featureFlags.getAllFlags());
        setConfig(featureFlags.getConfig());
        setImportText('');
        setShowImportExport(false);
        showMessage('success', 'Configuration imported successfully');
      } else {
        showMessage('error', 'Failed to import configuration');
      }
    } catch (e) {
      showMessage('error', 'Invalid JSON format');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const flagCategories = {
    'Provider Switches': [
      { key: 'useHydraAuth' as const, label: 'Use Ory Hydra Auth', description: 'Switch from Supabase Auth to Ory Hydra OAuth2/OIDC' },
      { key: 'useCloudflareR2' as const, label: 'Use Cloudflare R2', description: 'Switch from Supabase Storage to Cloudflare R2' },
      { key: 'useNeonDatabase' as const, label: 'Use Neon Database', description: 'Switch from Supabase DB to Neon PostgreSQL' },
      { key: 'usePostgREST' as const, label: 'Use PostgREST API', description: 'Switch from Supabase Client to direct PostgREST' },
    ],
    'Feature Toggles': [
      { key: 'enableSemanticSearch' as const, label: 'Semantic Search', description: 'AI-powered document search with embeddings' },
      { key: 'enableWorkflowSystem' as const, label: 'Workflow System', description: 'Document approval workflows' },
      { key: 'enableSharedLinks' as const, label: 'Shared Links', description: 'Public shareable document links' },
      { key: 'enableTwoFactorAuth' as const, label: 'Two-Factor Auth', description: 'TOTP-based 2FA for enhanced security' },
      { key: 'enableTelemetry' as const, label: 'Telemetry', description: 'Anonymous usage analytics with PostHog' },
      { key: 'enableAuditLogs' as const, label: 'Audit Logs', description: 'Comprehensive audit trail system' },
    ],
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Feature Flags & Configuration</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportExport(!showImportExport)}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            {showImportExport ? <Upload className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {showImportExport ? 'Hide' : 'Import/Export'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <AlertCircle className="w-5 h-5" />
          <span>{message.text}</span>
        </div>
      )}

      {showImportExport && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-3">Import/Export Configuration</h3>
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Current Config
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import Configuration (JSON)
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full h-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder='{"flags": {...}, "config": {...}}'
            />
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Configuration
            </button>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(flagCategories).map(([category, categoryFlags]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">{category}</h3>
            <div className="space-y-3">
              {categoryFlags.map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{label}</h4>
                      {flags[key] && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{description}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      flags[key] ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        flags[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Current Provider Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-800">Auth:</span>
            <span className="ml-2 text-blue-700">{featureFlags.getAuthProvider()}</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Storage:</span>
            <span className="ml-2 text-blue-700">{featureFlags.getStorageProvider()}</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Database:</span>
            <span className="ml-2 text-blue-700">{featureFlags.getDatabaseProvider()}</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">API:</span>
            <span className="ml-2 text-blue-700">{featureFlags.getApiProvider()}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Provider switches require proper infrastructure setup before activation</li>
              <li>Configuration changes persist in browser localStorage</li>
              <li>Export your config before making significant changes</li>
              <li>Some features may require page refresh to take full effect</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
