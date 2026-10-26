import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import type { Platform, PlatformConfig, PlatformAIMode } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import { apiClient } from '@/services/api';

interface Props {
  platform: Platform; // expected: platform.type === 'email'
}

type EmailConfig = {
  imap_host: string;
  imap_port: number | '';
  imap_username: string;
  imap_password: string;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number | '';
  smtp_username: string;
  smtp_password: string;
  smtp_use_ssl: boolean;
  smtp_use_tls: boolean;
  use_same_credentials: boolean;
};

const defaultEmailConfig: EmailConfig = {
  imap_host: '',
  imap_port: 993,
  imap_username: '',
  imap_password: '',
  imap_use_ssl: true,
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_use_ssl: false,
  smtp_use_tls: true,
  use_same_credentials: true,
};

// Email provider configuration mapping
interface ProviderConfig {
  name: string;
  imap_host: string;
  imap_port: number;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_use_ssl: boolean;
  smtp_use_tls: boolean;
}

const EMAIL_PROVIDERS: Record<string, ProviderConfig> = {
  'gmail.com': {
    name: 'Gmail',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  'qq.com': {
    name: 'QQ Mail',
    imap_host: 'imap.qq.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.qq.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
  'outlook.com': {
    name: 'Outlook',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  'hotmail.com': {
    name: 'Hotmail',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  'live.com': {
    name: 'Live',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  '163.com': {
    name: '163 Mail',
    imap_host: 'imap.163.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.163.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
  '126.com': {
    name: '126 Mail',
    imap_host: 'imap.126.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.126.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
};

// Extract domain from email address
const extractDomain = (email: string): string | null => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : null;
};

const EmailPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const savePlatformConfig = usePlatformStore(s => s.savePlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const deletePlatform = usePlatformStore(s => s.deletePlatform);
  const enablePlatform = usePlatformStore(s => s.enablePlatform);
  const disablePlatform = usePlatformStore(s => s.disablePlatform);
  const platforms = usePlatformStore(s => s.platforms);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const isEnabled = platform.status === 'connected';

  // Simplified/Advanced mode state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoDetectedProvider, setAutoDetectedProvider] = useState<string | null>(null);
  const [manuallyEdited, setManuallyEdited] = useState(false);

  // Name editing
  const [platformName, setPlatformName] = useState<string>(platform.name);
  useEffect(() => { setPlatformName(platform.name); }, [platform.name]);
  const hasNameChanged = useMemo(() => platformName.trim() !== platform.name, [platformName, platform.name]);

  // AI Settings state
  const [aiAgentIds, setAiAgentIds] = useState<string[]>(platform.agent_id ? [platform.agent_id] : []);
  const [aiMode, setAiMode] = useState<PlatformAIMode>(platform.ai_mode ?? 'auto');
  const [fallbackTimeout, setFallbackTimeout] = useState<number | null>(platform.fallback_to_ai_timeout ?? null);

  useEffect(() => {
    setAiAgentIds(platform.agent_id ? [platform.agent_id] : []);
    setAiMode(platform.ai_mode ?? 'auto');
    setFallbackTimeout(platform.fallback_to_ai_timeout ?? null);
  }, [platform.agent_id, platform.ai_mode, platform.fallback_to_ai_timeout]);

  const hasAISettingsChanged = useMemo(() => {
    const origAgentIds = platform.agent_id ? [platform.agent_id] : [];
    const origMode = platform.ai_mode ?? 'auto';
    const origTimeout = platform.fallback_to_ai_timeout ?? null;
    const agentIdsChanged = JSON.stringify(aiAgentIds.sort()) !== JSON.stringify([...origAgentIds].sort());
    const modeChanged = aiMode !== origMode;
    const timeoutChanged = fallbackTimeout !== origTimeout;
    return agentIdsChanged || modeChanged || timeoutChanged;
  }, [aiAgentIds, aiMode, fallbackTimeout, platform.agent_id, platform.ai_mode, platform.fallback_to_ai_timeout]);

  const canSave = hasConfigChanges || hasNameChanged || hasAISettingsChanged;

  // Local form state sourced from platform.config
  const initialFormValues: EmailConfig = useMemo(() => {
    const cfg = (platform.config || {}) as PlatformConfig as any;
    return {
      imap_host: cfg.imap_host ?? defaultEmailConfig.imap_host,
      imap_port: typeof cfg.imap_port === 'number' ? cfg.imap_port : (cfg.imap_port ? parseInt(cfg.imap_port, 10) || defaultEmailConfig.imap_port : defaultEmailConfig.imap_port),
      imap_username: cfg.imap_username ?? defaultEmailConfig.imap_username,
      imap_password: cfg.imap_password ?? defaultEmailConfig.imap_password,
      imap_use_ssl: typeof cfg.imap_use_ssl === 'boolean' ? cfg.imap_use_ssl : (cfg.imap_use_ssl ? Boolean(cfg.imap_use_ssl) : defaultEmailConfig.imap_use_ssl),
      smtp_host: cfg.smtp_host ?? defaultEmailConfig.smtp_host,
      smtp_port: typeof cfg.smtp_port === 'number' ? cfg.smtp_port : (cfg.smtp_port ? parseInt(cfg.smtp_port, 10) || defaultEmailConfig.smtp_port : defaultEmailConfig.smtp_port),
      smtp_username: cfg.smtp_username ?? defaultEmailConfig.smtp_username,
      smtp_password: cfg.smtp_password ?? defaultEmailConfig.smtp_password,
      smtp_use_ssl: typeof cfg.smtp_use_ssl === 'boolean' ? cfg.smtp_use_ssl : (cfg.smtp_use_ssl ? Boolean(cfg.smtp_use_ssl) : defaultEmailConfig.smtp_use_ssl),
      smtp_use_tls: typeof cfg.smtp_use_tls === 'boolean' ? cfg.smtp_use_tls : (cfg.smtp_use_tls ? Boolean(cfg.smtp_use_tls) : defaultEmailConfig.smtp_use_tls),
      use_same_credentials: typeof cfg.use_same_credentials === 'boolean' ? cfg.use_same_credentials : (cfg.use_same_credentials ? Boolean(cfg.use_same_credentials) : defaultEmailConfig.use_same_credentials),
    } as EmailConfig;
  }, [platform.config]);

  const [formValues, setFormValues] = useState<EmailConfig>(initialFormValues);
  useEffect(() => { setFormValues(initialFormValues); }, [initialFormValues]);

  // Auto-detect email provider and fill configuration
  useEffect(() => {
    if (manuallyEdited) return; // Don't override manual edits

    const email = formValues.imap_username;
    if (!email || !email.includes('@')) {
      setAutoDetectedProvider(null);
      return;
    }

    const domain = extractDomain(email);
    if (!domain || !EMAIL_PROVIDERS[domain]) {
      setAutoDetectedProvider(null);
      return;
    }

    const provider = EMAIL_PROVIDERS[domain];
    setAutoDetectedProvider(provider.name);

    // Auto-fill configuration
    setFormValues(prev => ({
      ...prev,
      imap_host: provider.imap_host,
      imap_port: provider.imap_port,
      imap_use_ssl: provider.imap_use_ssl,
      smtp_host: provider.smtp_host,
      smtp_port: provider.smtp_port,
      smtp_use_ssl: provider.smtp_use_ssl,
      smtp_use_tls: provider.smtp_use_tls,
      smtp_username: email,
      use_same_credentials: true,
    }));

    // Update store
    updatePlatformConfig(platform.id, {
      imap_host: provider.imap_host,
      imap_port: provider.imap_port,
      imap_use_ssl: provider.imap_use_ssl,
      smtp_host: provider.smtp_host,
      smtp_port: provider.smtp_port,
      smtp_use_ssl: provider.smtp_use_ssl,
      smtp_use_tls: provider.smtp_use_tls,
      smtp_username: email,
      use_same_credentials: true,
    });
  }, [formValues.imap_username, manuallyEdited, platform.id, updatePlatformConfig]);

  const handleChange = (patch: Partial<EmailConfig>, isManualEdit = false) => {
    // Mark as manually edited if user changes advanced fields
    if (isManualEdit && showAdvanced) {
      setManuallyEdited(true);
    }

    // Calculate the updated values with credential sync
    const updated = { ...formValues, ...patch };
    // Auto-sync credentials if use_same_credentials is enabled
    if (updated.use_same_credentials) {
      if (patch.imap_username !== undefined) updated.smtp_username = patch.imap_username;
      if (patch.imap_password !== undefined) updated.smtp_password = patch.imap_password;
    }

    // Update local state
    setFormValues(updated);

    // Ensure numeric type for ports when updating store
    const normalized: Partial<EmailConfig> = { ...updated };
    if (normalized.imap_port !== undefined) {
      const n = typeof normalized.imap_port === 'string' ? parseInt(normalized.imap_port as any, 10) : normalized.imap_port;
      normalized.imap_port = Number.isFinite(n as number) ? (n as number) : '';
    }
    if (normalized.smtp_port !== undefined) {
      const n = typeof normalized.smtp_port === 'string' ? parseInt(normalized.smtp_port as any, 10) : normalized.smtp_port;
      normalized.smtp_port = Number.isFinite(n as number) ? (n as number) : '';
    }

    // Accumulate changes into store for Save
    const toSave: Partial<PlatformConfig> = {
      ...(normalized.imap_host !== undefined ? { imap_host: normalized.imap_host } : {}),
      ...((normalized.imap_port !== undefined && normalized.imap_port !== '') ? { imap_port: normalized.imap_port as number } : {}),
      ...(normalized.imap_username !== undefined ? { imap_username: normalized.imap_username } : {}),
      ...(normalized.imap_password !== undefined ? { imap_password: normalized.imap_password } : {}),
      ...(normalized.imap_use_ssl !== undefined ? { imap_use_ssl: Boolean(normalized.imap_use_ssl) } : {}),
      ...(normalized.smtp_host !== undefined ? { smtp_host: normalized.smtp_host } : {}),
      ...((normalized.smtp_port !== undefined && normalized.smtp_port !== '') ? { smtp_port: normalized.smtp_port as number } : {}),
      ...(normalized.smtp_username !== undefined ? { smtp_username: normalized.smtp_username } : {}),
      ...(normalized.smtp_password !== undefined ? { smtp_password: normalized.smtp_password } : {}),
      ...(normalized.smtp_use_ssl !== undefined ? { smtp_use_ssl: Boolean(normalized.smtp_use_ssl) } : {}),
      ...(normalized.smtp_use_tls !== undefined ? { smtp_use_tls: Boolean(normalized.smtp_use_tls) } : {}),
      ...(normalized.use_same_credentials !== undefined ? { use_same_credentials: Boolean(normalized.use_same_credentials) } : {}),
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const [showPassword, setShowPassword] = useState(false);

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};

      if (hasConfigChanges) {
        await savePlatformConfig(platform.id);
      }
      if (hasNameChanged) {
        updates.name = platformName.trim();
      }
      if (hasAISettingsChanged) {
        updates.agent_id = aiAgentIds[0] ?? null;
        updates.ai_mode = aiMode;
        updates.fallback_to_ai_timeout = aiMode === 'assist' ? fallbackTimeout : null;
      }

      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
      }
      showSuccess(showToast, t('platforms.email.messages.saveSuccess', 'Saved Successfully'), t('platforms.email.messages.saveSuccessMessage', 'Email platform configuration has been saved'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const handleTestConnection = async () => {
    // Validate required fields
    if (!formValues.imap_username || !formValues.imap_password || !formValues.imap_host || !formValues.imap_port ||
        !formValues.smtp_host || !formValues.smtp_port) {
      showToast('error', t('platforms.email.messages.testValidationError', 'Please fill in all required email configuration fields'));
      return;
    }

    setIsTesting(true);
    try {
      // Prepare request body
      const requestBody = {
        imap_host: formValues.imap_host,
        imap_port: typeof formValues.imap_port === 'number' ? formValues.imap_port : parseInt(String(formValues.imap_port), 10),
        imap_username: formValues.imap_username,
        imap_password: formValues.imap_password,
        imap_use_ssl: formValues.imap_use_ssl,
        smtp_host: formValues.smtp_host,
        smtp_port: typeof formValues.smtp_port === 'number' ? formValues.smtp_port : parseInt(String(formValues.smtp_port), 10),
        smtp_username: formValues.use_same_credentials ? formValues.imap_username : formValues.smtp_username,
        smtp_password: formValues.use_same_credentials ? formValues.imap_password : formValues.smtp_password,
        smtp_use_tls: formValues.smtp_use_tls,
      };

      // Call API
      interface EmailConnectionTestResponse {
        smtp_status: string;
        smtp_message: string;
        imap_status: string;
        imap_message: string;
        overall_success: boolean;
      }

      const response = await apiClient.post<EmailConnectionTestResponse>('/v1/email/test-connection', requestBody);

      // Show result
      if (response.overall_success) {
        showSuccess(
          showToast,
          t('platforms.email.messages.testSuccess', 'Connection Test Successful'),
          t('platforms.email.messages.testSuccessMessage', 'Both IMAP and SMTP connections are working')
        );
      } else {
        // Show detailed error message
        const errorDetails = [];
        if (response.smtp_status !== 'success') {
          errorDetails.push(`SMTP: ${response.smtp_message}`);
        }
        if (response.imap_status !== 'success') {
          errorDetails.push(`IMAP: ${response.imap_message}`);
        }
        showToast('error', t('platforms.email.messages.testFailed', 'Connection Test Failed'), errorDetails.join('\n'));
      }
    } catch (e) {
      showApiError(showToast, e);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <main className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{platform.name} - {t('platforms.email.header.title', 'Email Platform Configuration')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('platforms.email.header.subtitle', 'Configure IMAP (receiving) and SMTP (sending) information.')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={isUpdating || isDeleting}
            onClick={() => setConfirmOpen(true)}
            className={`px-3 py-1.5 text-sm rounded-md ${isDeleting ? 'bg-red-400 text-white' : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600'}`}
          >
            {isDeleting ? t('platforms.email.buttons.deleting', 'Deleting...') : t('platforms.email.buttons.delete', 'Delete')}
          </button>
          <button
            disabled={isUpdating || isDeleting || isToggling}
            onClick={async () => {
              if (isToggling) return;
              setIsToggling(true);
              try {
                if (isEnabled) {
                  await disablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.email.messages.disabled', 'Platform Disabled'));
                } else {
                  await enablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.email.messages.enabled', 'Platform Enabled'));
                }
              } catch (e) {
                showApiError(showToast, e);
              } finally {
                setIsToggling(false);
              }
            }}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${isEnabled ? 'bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'} ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isToggling ? (isEnabled ? t('platforms.email.buttons.disabling', 'Disabling...') : t('platforms.email.buttons.enabling', 'Enabling...')) : (isEnabled ? t('platforms.email.buttons.disable', 'Disable') : t('platforms.email.buttons.enable', 'Enable'))}
          </button>
          <button
            disabled={isTesting}
            onClick={handleTestConnection}
            className={`px-3 py-1.5 text-sm rounded-md ${isTesting ? 'bg-purple-400 text-white cursor-not-allowed' : 'bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600'}`}
          >
            {isTesting ? t('platforms.email.buttons.testing', 'Testing...') : t('platforms.email.buttons.testConnection', 'Test Connection')}
          </button>
          <button
            disabled={!canSave || isUpdating}
            onClick={handleSave}
            className={`px-3 py-1.5 text-sm rounded-md ${canSave ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
          >
            {isUpdating ? t('platforms.email.buttons.saving', 'Saving...') : t('platforms.email.buttons.save', 'Save')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 p-6">
        {/* Left: form */}
        <section className="lg:w-2/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 space-y-4 overflow-y-auto min-h-0 auto-hide-scrollbar">
          {/* Platform name */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.name', 'Platform Name')}</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={t('platforms.email.form.namePlaceholder', 'Enter platform name')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          {/* Simplified Mode: Email Address and Password */}
          <div className="space-y-4">
            {/* Email address */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                {t('platforms.email.form.emailAddress', 'Email Address')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="email"
                value={formValues.imap_username}
                onChange={(e) => handleChange({ imap_username: e.target.value })}
                placeholder={t('platforms.email.form.emailPlaceholder', 'you@example.com')}
                className="w-full text-sm p-2 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
              />
              {autoDetectedProvider && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ {t('platforms.email.form.autoDetected', 'Auto-detected as')} {autoDetectedProvider}
                </p>
              )}
            </div>

            {/* Email password */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                {t('platforms.email.form.emailPassword', 'Email Password')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formValues.imap_password}
                  onChange={(e) => handleChange({ imap_password: e.target.value })}
                  placeholder={showPassword ? t('platforms.email.form.passwordPlaceholder', 'Enter email password or authorization code') : '********'}
                  className="flex-1 text-sm p-2 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="px-3 py-2 text-xs rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  {showPassword ? t('platforms.email.buttons.hide', 'Hide') : t('platforms.email.buttons.show', 'Show')}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('platforms.email.form.passwordHint', 'Gmail/QQ Mail requires app-specific password or authorization code')}
              </p>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>{showAdvanced ? t('platforms.email.form.hideAdvanced', 'Hide Advanced Settings') : t('platforms.email.form.showAdvanced', 'Show Advanced Settings')}</span>
            </button>
          </div>

          {/* AI Settings */}
          <PlatformAISettings
            platform={platform}
            agentIds={aiAgentIds}
            aiMode={aiMode}
            fallbackTimeout={fallbackTimeout}
            onAgentIdsChange={setAiAgentIds}
            onAIModeChange={setAiMode}
            onFallbackTimeoutChange={setFallbackTimeout}
          />

          {/* Advanced Settings (Collapsible) */}
          {showAdvanced && (
            <div className="space-y-4 animate-fadeIn">
              {/* IMAP Configuration */}
              <div className="bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-md space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <span>📥</span>
                  <span>{t('platforms.email.form.imapSection', 'IMAP Configuration (Receiving Emails)')}</span>
                </h4>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.imapHost', 'IMAP Server')}</label>
                  <input
                    type="text"
                    value={formValues.imap_host}
                    onChange={(e) => handleChange({ imap_host: e.target.value }, true)}
                    placeholder={t('platforms.email.form.imapHostPlaceholder', 'e.g., imap.gmail.com')}
                    className={`w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:text-gray-200 ${autoDetectedProvider ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white/90 dark:bg-gray-700/50'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.imapPort', 'IMAP Port')}</label>
                    <input
                      type="number"
                      value={formValues.imap_port}
                      onChange={(e) => handleChange({ imap_port: e.target.value === '' ? '' : parseInt(e.target.value, 10) || '' }, true)}
                      placeholder="993"
                      className={`w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:text-gray-200 ${autoDetectedProvider ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white/90 dark:bg-gray-700/50'}`}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center gap-2 h-[34px]">
                      <input
                        id="imapUseSsl"
                        type="checkbox"
                        checked={formValues.imap_use_ssl}
                        onChange={(e) => handleChange({ imap_use_ssl: e.target.checked }, true)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <label htmlFor="imapUseSsl" className="text-xs text-gray-700 dark:text-gray-300 select-none">{t('platforms.email.form.useSsl', 'Use SSL')}</label>
                    </div>
                  </div>
                </div>
              </div>

              {/* SMTP Configuration */}
              <div className="bg-green-50/50 dark:bg-green-900/20 p-4 rounded-md space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <span>📤</span>
                  <span>{t('platforms.email.form.smtpSection', 'SMTP Configuration (Sending Emails)')}</span>
                </h4>

                {/* Use the same credentials */}
                <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-700/40 p-2 rounded-md">
                  <input
                    id="useSameCredentials"
                    type="checkbox"
                    checked={formValues.use_same_credentials}
                    onChange={(e) => handleChange({ use_same_credentials: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label htmlFor="useSameCredentials" className="text-xs text-gray-700 dark:text-gray-300 select-none">{t('platforms.email.form.useSameCredentials', 'Use Same Credentials for SMTP (Recommended)')}</label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.smtpHost', 'SMTP Server')}</label>
                  <input
                    type="text"
                    value={formValues.smtp_host}
                    onChange={(e) => handleChange({ smtp_host: e.target.value }, true)}
                    placeholder={t('platforms.email.form.smtpHostPlaceholder', 'e.g., smtp.gmail.com')}
                    className={`w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:text-gray-200 ${autoDetectedProvider ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white/90 dark:bg-gray-700/50'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.smtpPort', 'SMTP Port')}</label>
                    <input
                      type="number"
                      value={formValues.smtp_port}
                      onChange={(e) => handleChange({ smtp_port: e.target.value === '' ? '' : parseInt(e.target.value, 10) || '' }, true)}
                      placeholder="587"
                      className={`w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:text-gray-200 ${autoDetectedProvider ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white/90 dark:bg-gray-700/50'}`}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          id="smtpUseSsl"
                          type="checkbox"
                          checked={formValues.smtp_use_ssl}
                          onChange={(e) => handleChange({ smtp_use_ssl: e.target.checked, smtp_use_tls: e.target.checked ? false : formValues.smtp_use_tls }, true)}
                          className="w-3 h-3 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <label htmlFor="smtpUseSsl" className="text-xs text-gray-700 dark:text-gray-300 select-none">SSL</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          id="smtpUseTls"
                          type="checkbox"
                          checked={formValues.smtp_use_tls}
                          onChange={(e) => handleChange({ smtp_use_tls: e.target.checked, smtp_use_ssl: e.target.checked ? false : formValues.smtp_use_ssl }, true)}
                          className="w-3 h-3 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <label htmlFor="smtpUseTls" className="text-xs text-gray-700 dark:text-gray-300 select-none">TLS</label>
                      </div>
                    </div>
                  </div>
                </div>

                {!formValues.use_same_credentials && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.smtpUsername', 'SMTP Username')}</label>
                      <input
                        type="email"
                        value={formValues.smtp_username}
                        onChange={(e) => handleChange({ smtp_username: e.target.value }, true)}
                        placeholder={t('platforms.email.form.smtpUsernamePlaceholder', 'Usually same as email address')}
                        className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.smtpPassword', 'SMTP Password')}</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formValues.smtp_password}
                        onChange={(e) => handleChange({ smtp_password: e.target.value }, true)}
                        placeholder={showPassword ? t('platforms.email.form.smtpPasswordPlaceholder', 'Enter SMTP password') : '********'}
                        className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right: comprehensive guide */}
        <section className="lg:w-3/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 min-h-0 overflow-y-auto auto-hide-scrollbar space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('platforms.email.guide.title', 'Email Platform Configuration Guide (IMAP Receiving + SMTP Sending)')}</h3>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm rounded-md p-3">
            <p className="font-medium">{t('platforms.email.guide.tipTitle', 'Tip')}</p>
            <p className="mt-1" dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.tipMessage', 'IMAP is for receiving emails, SMTP is for sending emails. Common ports: <span class="font-mono">IMAP SSL=993</span>, <span class="font-mono">SMTP SSL=465</span>, <span class="font-mono">SMTP TLS=587</span>.') }} />
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('platforms.email.guide.section1Title', '1. Get Email Credentials (General Steps)')}</h4>
            <ol className="list-decimal pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>{t('platforms.email.guide.section1Step1', 'Log in to your email service provider account (Gmail / Outlook / QQ Mail, etc.).')}</li>
              <li>{t('platforms.email.guide.section1Step2', 'Go to \'Account Settings\' or \'Security\' page, enable IMAP/SMTP service (if required).')}</li>
              <li>{t('platforms.email.guide.section1Step3', 'If required by the service provider (such as Gmail/QQ), enable two-step verification and create an \'App-specific password\'.')}</li>
              <li>{t('platforms.email.guide.section1Step4', 'Fill in IMAP and SMTP configuration in the left form. If using same credentials, check \'Use Same Credentials for SMTP\'.')}</li>
              <li>{t('platforms.email.guide.section1Step5', 'Click \'Save\' in the upper right corner, then test sending and receiving emails.')}</li>
            </ol>
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('platforms.email.guide.section2Title', '2. Common Email Servers and Ports')}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
                  <tr>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableProvider', 'Provider')}</th>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableImapServer', 'IMAP Server')}</th>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableImapPort', 'IMAP Port')}</th>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableSmtpServer', 'SMTP Server')}</th>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableSmtpPort', 'SMTP Port')}</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  <tr className="odd:bg-white dark:odd:bg-gray-800 even:bg-gray-50 dark:even:bg-gray-700">
                    <td className="px-3 py-2 border-b dark:border-gray-600">Gmail</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">imap.gmail.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">993</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">smtp.gmail.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">465/587</td>
                  </tr>
                  <tr className="odd:bg-white dark:odd:bg-gray-800 even:bg-gray-50 dark:even:bg-gray-700">
                    <td className="px-3 py-2 border-b dark:border-gray-600">Outlook</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">outlook.office365.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">993</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">smtp.office365.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">587</td>
                  </tr>
                  <tr className="odd:bg-white dark:odd:bg-gray-800 even:bg-gray-50 dark:even:bg-gray-700">
                    <td className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableQQMail', 'QQ Mail')}</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">imap.qq.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">993</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">smtp.qq.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">465/587</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('platforms.email.guide.section3Title', '3. Detailed Provider Configuration')}</h4>
            <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
              <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">{t('platforms.email.guide.gmailTitle', 'Gmail (App-specific Password)')}</summary>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                <ol className="list-decimal pl-5 space-y-1">
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep1', 'Go to Google Account Security Center → Two-step Verification → App-specific Password; confirm IMAP/SMTP is enabled.') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep2', 'IMAP server: <code class="px-1 bg-gray-100 rounded">imap.gmail.com</code>, port: 993 (SSL).') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep3', 'SMTP server: <code class="px-1 bg-gray-100 rounded">smtp.gmail.com</code>, port: 465 (SSL) or 587 (TLS).') }} />
                  <li>{t('platforms.email.guide.gmailStep4', 'Username is your Gmail address; password uses app-specific password (same for IMAP and SMTP).')}</li>
                </ol>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-xs overflow-x-auto dark:text-gray-300">
                  <pre>{`IMAP_HOST=imap.gmail.com
IMAP_PORT=993
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
USERNAME=you@gmail.com
PASSWORD=${t('platforms.email.guide.gmailPasswordPlaceholder', 'App-specific password')}
USE_SAME_CREDENTIALS=true`}</pre>
                </div>
                <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer">{t('platforms.email.guide.gmailDocs', 'Gmail Official Guide')}</a>
              </div>
            </details>

            <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
              <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">{t('platforms.email.guide.outlookTitle', 'Outlook（Office 365）')}</summary>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                <ul className="list-disc pl-5 space-y-1">
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.outlookStep1', 'IMAP server: <code class="px-1 bg-gray-100 rounded">outlook.office365.com</code>, port: 993 (SSL).') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.outlookStep2', 'SMTP server: <code class="px-1 bg-gray-100 rounded">smtp.office365.com</code>, port: 587 (TLS).') }} />
                  <li>{t('platforms.email.guide.outlookStep3', 'Username is usually the email address; IMAP and SMTP use same credentials.')}</li>
                </ul>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-xs overflow-x-auto dark:text-gray-300">
                  <pre>{`IMAP_HOST=outlook.office365.com
IMAP_PORT=993
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
USERNAME=you@outlook.com
USE_SAME_CREDENTIALS=true`}</pre>
                </div>
                <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/pop-imap-smtp-settings" target="_blank" rel="noreferrer">{t('platforms.email.guide.outlookDocs', 'Microsoft Documentation')}</a>
              </div>
            </details>

            <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
              <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">{t('platforms.email.guide.qqTitle', 'QQ Mail (Enable IMAP/SMTP Required)')}</summary>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>{t('platforms.email.guide.qqStep1', 'Go to QQ Mail Settings → Account → Enable \'IMAP/SMTP Service\'.')}</li>
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.qqStep2', 'Get authorization code as password; IMAP server: <code class="px-1 bg-gray-100 rounded">imap.qq.com</code>, port: 993.') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.qqStep3', 'SMTP server: <code class="px-1 bg-gray-100 rounded">smtp.qq.com</code>, port: 465 (SSL) or 587 (TLS).') }} />
                  <li>{t('platforms.email.guide.qqStep4', 'IMAP and SMTP use the same authorization code.')}</li>
                </ol>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-xs overflow-x-auto dark:text-gray-300">
                  <pre>{`IMAP_HOST=imap.qq.com
IMAP_PORT=993
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
USERNAME=your_qq@qq.com
PASSWORD=${t('platforms.email.guide.qqPasswordPlaceholder', 'Authorization code')}
USE_SAME_CREDENTIALS=true`}</pre>
                </div>
                <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://wx.mail.qq.com/list/readtemplate?name=app_intro.html#/agreement/authorizationCode" target="_blank" rel="noreferrer">{t('platforms.email.guide.qqDocs', 'QQ Mail Help')}</a>
              </div>
            </details>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 text-sm rounded-md p-3">
            <p className="font-semibold">{t('platforms.email.guide.troubleshootTitle', 'Troubleshooting Guide')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>{t('platforms.email.guide.troubleshootItem1', 'Confirm that the service provider has enabled IMAP/SMTP service; Gmail/QQ need to enable in settings and use app-specific password/authorization code.')}</li>
              <li>{t('platforms.email.guide.troubleshootItem2', 'IMAP: prioritize SSL (port 993); SMTP: recommend TLS (port 587) or SSL (port 465).')}</li>
              <li>{t('platforms.email.guide.troubleshootItem3', 'Verify that the email address (username) and password are correct, pay attention to case and spaces.')}</li>
              <li>{t('platforms.email.guide.troubleshootItem4', 'If \'Use Same Credentials\' is checked, ensure IMAP and SMTP use the same username and password.')}</li>
              <li>{t('platforms.email.guide.troubleshootItem5', 'If still failing, check if you need to allow third-party client access in the service provider backend.')}</li>
            </ul>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>{t('platforms.email.guide.moreInfo', 'More documentation: Official documentation and support pages of each email service provider.')}</p>
          </div>
        </section>
      </div>
      {/* Scoped scrollbar style and animations */}
      <style>{`
        .auto-hide-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.3) transparent; }
        .auto-hide-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .auto-hide-scrollbar::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 4px; }
        .auto-hide-scrollbar:hover::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.35); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('platforms.email.confirm.deleteTitle', 'Delete Platform')}
        message={t('platforms.email.confirm.deleteMessage', 'Are you sure you want to delete this platform?')}
        confirmText={t('platforms.email.confirm.confirmText', 'Delete')}
        cancelText={t('platforms.email.confirm.cancelText', 'Cancel')}
        confirmVariant="danger"
        isLoading={isDeleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (isDeleting) return;
          setIsDeleting(true);
          try {
            const idx = platforms.findIndex(p => p.id === platform.id);
            const nextId = idx !== -1
              ? (idx < platforms.length - 1 ? platforms[idx + 1]?.id : (idx > 0 ? platforms[idx - 1]?.id : null))
              : null;
            await deletePlatform(platform.id);
            showSuccess(showToast, t('platforms.email.messages.deleteSuccess', 'Platform Deleted'), t('platforms.email.messages.deleteSuccessMessage', 'Platform has been deleted'));
            setConfirmOpen(false);
            if (nextId) navigate(`/platforms/${nextId}`);
            else navigate('/platforms');
          } catch (e) {
            showApiError(showToast, e);
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </main>
  );
};

export default EmailPlatformConfig;

