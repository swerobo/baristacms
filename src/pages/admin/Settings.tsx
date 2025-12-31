import { useEffect, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { useTheme, themeOptions, type ThemeColor } from '../../context/ThemeContext';
import { settingsService, type SiteSettings } from '../../services/api';
import {
  ShieldCheckIcon,
  Cog6ToothIcon,
  CheckIcon,
  ArrowPathIcon,
  SwatchIcon,
  EnvelopeIcon,
  BugAntIcon,
  CircleStackIcon,
  ArrowDownTrayIcon,
  CloudIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const { isAdmin } = useUser();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [siteName, setSiteName] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeColor>(theme);
  const [emailCheckInterval, setEmailCheckInterval] = useState('0');
  const [enableDebugLogging, setEnableDebugLogging] = useState(false);

  // Azure AD / M365 Authentication settings
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');

  // Email configuration settings
  const [emailProvider, setEmailProvider] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [emailInbox, setEmailInbox] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbInfo, setDbInfo] = useState<{ type: string; database: string } | null>(null);
  const [dbInfoError, setDbInfoError] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadDatabaseInfo();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getAll();
      setSettings(data);
      setSiteName(data.site_name?.value || '');
      if (data.theme_color?.value) {
        setSelectedTheme(data.theme_color.value as ThemeColor);
      }
      setEmailCheckInterval(data.email_check_interval_minutes?.value || '0');
      setEnableDebugLogging(data.enable_debug_logging?.value === 'true');

      // Azure AD settings
      setAzureTenantId(data.azure_tenant_id?.value || '');
      setAzureClientId(data.azure_client_id?.value || '');
      setAzureClientSecret(data.azure_client_secret?.value || '');

      // Email configuration settings
      setEmailProvider(data.email_provider?.value || '');
      setEmailFrom(data.email_from?.value || '');
      setEmailInbox(data.email_inbox?.value || '');
      setSmtpHost(data.smtp_host?.value || 'smtp.office365.com');
      setSmtpPort(data.smtp_port?.value || '587');
      setSmtpUser(data.smtp_user?.value || '');
      setSmtpPassword(data.smtp_password?.value || '');
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseInfo = async () => {
    try {
      setDbInfoError(null);
      const data = await settingsService.getDatabaseInfo();
      setDbInfo(data);
    } catch (err) {
      console.error('Failed to load database info:', err);
      setDbInfoError(err instanceof Error ? err.message : 'Failed to load database info');
    }
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      const { blob, filename } = await settingsService.downloadBackup();

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to create backup:', err);
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      await settingsService.update('site_name', siteName, 'string', 'The name of the site displayed in the header');
      await settingsService.update('theme_color', selectedTheme, 'string', 'The theme color for the application');
      await settingsService.update('email_check_interval_minutes', emailCheckInterval, 'number', 'Interval in minutes to check for new emails (0 = disabled)');
      await settingsService.update('enable_debug_logging', enableDebugLogging.toString(), 'boolean', 'Enable verbose debug logging in server console');

      // Azure AD settings
      await settingsService.update('azure_tenant_id', azureTenantId, 'string', 'Azure AD Tenant ID for M365 authentication');
      await settingsService.update('azure_client_id', azureClientId, 'string', 'Azure AD Client/Application ID');
      await settingsService.update('azure_client_secret', azureClientSecret, 'string', 'Azure AD Client Secret (encrypted)');

      // Email configuration settings
      await settingsService.update('email_provider', emailProvider, 'string', 'Email provider: graph or smtp');
      await settingsService.update('email_from', emailFrom, 'string', 'Sender email address');
      await settingsService.update('email_inbox', emailInbox, 'string', 'Inbox email address for receiving emails');
      await settingsService.update('smtp_host', smtpHost, 'string', 'SMTP server hostname');
      await settingsService.update('smtp_port', smtpPort, 'string', 'SMTP server port');
      await settingsService.update('smtp_user', smtpUser, 'string', 'SMTP username');
      await settingsService.update('smtp_password', smtpPassword, 'string', 'SMTP password (encrypted)');

      // Apply theme immediately
      setTheme(selectedTheme);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Reload settings
      await loadSettings();
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <ShieldCheckIcon className="h-12 w-12 mx-auto text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
          <p className="text-red-600 mt-1">You need administrator privileges to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--theme-accent)' }}></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure system settings and preferences.</p>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckIcon className="h-5 w-5" />
          Settings saved successfully!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* General Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Site Name */}
          <div>
            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
              Site Name
            </label>
            <input
              type="text"
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Enter site name..."
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
            />
            <p className="mt-1 text-sm text-gray-500">
              The name displayed in the application header and browser title.
            </p>
          </div>

          {/* Last Updated Info */}
          {settings.site_name?.updated_at && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(settings.site_name.updated_at).toLocaleString()}
              {settings.site_name.updated_by && ` by ${settings.site_name.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--theme-accent)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent)'}
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <SwatchIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Theme Settings</h2>
          </div>
        </div>

        <div className="p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Theme Color
            </label>
            <div className="flex flex-wrap gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedTheme(option.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedTheme === option.value
                      ? 'border-gray-900 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="text-sm font-medium text-gray-700">{option.label}</span>
                  {selectedTheme === option.value && (
                    <CheckIcon className="h-4 w-4 text-gray-700" />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Choose a theme color for the sidebar and accent elements.
            </p>
          </div>

          {/* Theme Last Updated Info */}
          {settings.theme_color?.updated_at && (
            <div className="mt-4 text-sm text-gray-500">
              Last updated: {new Date(settings.theme_color.updated_at).toLocaleString()}
              {settings.theme_color.updated_by && ` by ${settings.theme_color.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--theme-accent)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent)'}
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Azure AD / M365 Authentication */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <CloudIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Azure AD / M365 Authentication</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-500">
            Configure Microsoft 365 / Azure AD authentication. These settings are used for M365 login and Microsoft Graph API (email sending/receiving).
          </p>

          {/* Tenant ID */}
          <div>
            <label htmlFor="azureTenantId" className="block text-sm font-medium text-gray-700 mb-1">
              Tenant ID
            </label>
            <input
              type="text"
              id="azureTenantId"
              value={azureTenantId}
              onChange={(e) => setAzureTenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full max-w-lg px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent font-mono text-sm"
              style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
            />
            <p className="mt-1 text-sm text-gray-500">
              Your Azure AD tenant ID (found in Azure Portal &gt; Azure Active Directory &gt; Overview).
            </p>
          </div>

          {/* Client ID */}
          <div>
            <label htmlFor="azureClientId" className="block text-sm font-medium text-gray-700 mb-1">
              Client ID (Application ID)
            </label>
            <input
              type="text"
              id="azureClientId"
              value={azureClientId}
              onChange={(e) => setAzureClientId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full max-w-lg px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent font-mono text-sm"
              style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
            />
            <p className="mt-1 text-sm text-gray-500">
              The Application (client) ID from your Azure AD app registration.
            </p>
          </div>

          {/* Client Secret */}
          <div>
            <label htmlFor="azureClientSecret" className="block text-sm font-medium text-gray-700 mb-1">
              Client Secret
            </label>
            <input
              type="password"
              id="azureClientSecret"
              value={azureClientSecret}
              onChange={(e) => setAzureClientSecret(e.target.value)}
              placeholder="Enter client secret..."
              className="w-full max-w-lg px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
            />
            <p className="mt-1 text-sm text-gray-500">
              The client secret from your Azure AD app registration. This is encrypted when stored.
            </p>
          </div>

          {settings.azure_tenant_id?.updated_at && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(settings.azure_tenant_id.updated_at).toLocaleString()}
              {settings.azure_tenant_id.updated_by && ` by ${settings.azure_tenant_id.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--theme-accent)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent)'}
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <ServerIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Email Configuration</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-500">
            Configure email sending and receiving. Choose Microsoft Graph (recommended for M365) or SMTP.
          </p>

          {/* Email Provider */}
          <div>
            <label htmlFor="emailProvider" className="block text-sm font-medium text-gray-700 mb-1">
              Email Provider
            </label>
            <select
              id="emailProvider"
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
            >
              <option value="">Auto-detect</option>
              <option value="graph">Microsoft Graph (OAuth2)</option>
              <option value="smtp">SMTP</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Microsoft Graph is recommended for Office 365. SMTP is for traditional email servers.
            </p>
          </div>

          {/* Email From */}
          <div>
            <label htmlFor="emailFrom" className="block text-sm font-medium text-gray-700 mb-1">
              From Address
            </label>
            <input
              type="email"
              id="emailFrom"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="noreply@company.com"
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
            />
            <p className="mt-1 text-sm text-gray-500">
              The email address used to send emails.
            </p>
          </div>

          {/* Email Inbox */}
          <div>
            <label htmlFor="emailInbox" className="block text-sm font-medium text-gray-700 mb-1">
              Inbox Address (optional)
            </label>
            <input
              type="email"
              id="emailInbox"
              value={emailInbox}
              onChange={(e) => setEmailInbox(e.target.value)}
              placeholder="inbox@company.com"
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
            />
            <p className="mt-1 text-sm text-gray-500">
              The email address to monitor for incoming emails. Defaults to From Address if not set.
            </p>
          </div>

          {/* SMTP Settings */}
          {(emailProvider === 'smtp' || emailProvider === '') && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">SMTP Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                {/* SMTP Host */}
                <div>
                  <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    id="smtpHost"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.office365.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
                  />
                </div>

                {/* SMTP Port */}
                <div>
                  <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="text"
                    id="smtpPort"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
                  />
                </div>

                {/* SMTP User */}
                <div>
                  <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    id="smtpUser"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="user@company.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
                  />
                </div>

                {/* SMTP Password */}
                <div>
                  <label htmlFor="smtpPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Password
                  </label>
                  <input
                    type="password"
                    id="smtpPassword"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
                  />
                </div>
              </div>
            </div>
          )}

          {settings.email_from?.updated_at && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(settings.email_from.updated_at).toLocaleString()}
              {settings.email_from.updated_by && ` by ${settings.email_from.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--theme-accent)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent)'}
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Email Settings */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Email Processing</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Email Check Interval */}
          <div>
            <label htmlFor="emailCheckInterval" className="block text-sm font-medium text-gray-700 mb-1">
              Email Check Interval (minutes)
            </label>
            <input
              type="number"
              id="emailCheckInterval"
              value={emailCheckInterval}
              onChange={(e) => setEmailCheckInterval(e.target.value)}
              min="0"
              max="60"
              className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--theme-accent)' } as React.CSSProperties}
            />
            <p className="mt-1 text-sm text-gray-500">
              How often to check for new emails and automatically create records. Set to 0 to disable.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Note: Modules must have "Auto-process emails" enabled to automatically create records.
            </p>
            {parseInt(emailCheckInterval) > 0 && (
              <p className="mt-2 text-sm text-green-600">
                Email processor will check every {emailCheckInterval} minute(s).
              </p>
            )}
          </div>

          {/* Email Interval Last Updated Info */}
          {settings.email_check_interval_minutes?.updated_at && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(settings.email_check_interval_minutes.updated_at).toLocaleString()}
              {settings.email_check_interval_minutes.updated_by && ` by ${settings.email_check_interval_minutes.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--theme-accent)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent)'}
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Debug Settings */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <BugAntIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Debug Settings</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Enable Debug Logging */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableDebugLogging}
                onChange={(e) => setEnableDebugLogging(e.target.checked)}
                className="rounded border-gray-300 h-5 w-5"
                style={{ accentColor: 'var(--theme-accent)' }}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Debug Logging</span>
                <p className="text-sm text-gray-500">
                  Show verbose debug messages in server console (e.g., email processor logs).
                </p>
              </div>
            </label>
          </div>

          {/* Debug Setting Last Updated Info */}
          {settings.enable_debug_logging?.updated_at && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(settings.enable_debug_logging.updated_at).toLocaleString()}
              {settings.enable_debug_logging.updated_by && ` by ${settings.enable_debug_logging.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--theme-accent)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-accent)'}
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Database Settings */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <CircleStackIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Database Settings</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Database Info */}
          {dbInfoError ? (
            <div className="text-sm text-red-600">Error: {dbInfoError}</div>
          ) : dbInfo ? (
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <span className="block text-sm font-medium text-gray-700">Database Type</span>
                <span className="text-sm text-gray-900 font-medium">
                  {dbInfo.type === 'mysql' ? 'MySQL' : 'SQLite'}
                </span>
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700">Database Name</span>
                <span className="text-sm text-gray-900">{dbInfo.database}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading database info...</div>
          )}

          {/* Backup Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Database Backup
            </label>
            {dbInfo?.type === 'mysql' ? (
              <p className="text-sm text-gray-500 mb-3">
                Creates a MySQL dump file (.sql) using mysqldump. Make sure mysqldump is installed on the server.
              </p>
            ) : (
              <p className="text-sm text-gray-500 mb-3">
                Downloads the SQLite database file (.db).
              </p>
            )}
            <button
              onClick={handleBackup}
              disabled={backupLoading || !dbInfo}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backupLoading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Creating Backup...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download Backup ({dbInfo?.type === 'mysql' ? '.sql' : '.db'})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
