import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import type { Platform, PlatformConfig, PlatformAIMode } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';

interface Props {
  platform: Platform; // expected: platform.type === 'douyin' or 'tiktok'
}

type DouyinConfig = {
  appId: string;
  appSecret: string;
  clientKey: string;
  clientSecret: string;
  callbackUrl: string; // read-only (from backend)
  authScope: string; // comma-separated scopes, e.g., "user_info,video.list"
};

const defaultDouyinConfig: DouyinConfig = {
  appId: '',
  appSecret: '',
  clientKey: '',
  clientSecret: '',
  callbackUrl: '',
  authScope: '',
};

const DouyinPlatformConfig: React.FC<Props> = ({ platform }) => {
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
  const isEnabled = platform.status === 'connected';

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
  const initialFormValues: DouyinConfig = useMemo(() => {
    const cfg = (platform.config || {}) as PlatformConfig as any;
    // callbackUrl: prefer explicit callbackUrl if provided; else fall back to webhookUrl as in WeCom
    const cb = (cfg.callbackUrl ?? cfg.webhookUrl ?? defaultDouyinConfig.callbackUrl) as string;
    // authScope: accept string or array from backend
    let scope: string = defaultDouyinConfig.authScope;
    const rawScope = cfg.authScope;
    if (Array.isArray(rawScope)) scope = rawScope.join(',');
    else if (typeof rawScope === 'string') scope = rawScope;

    return {
      appId: cfg.appId ?? defaultDouyinConfig.appId,
      appSecret: cfg.appSecret ?? defaultDouyinConfig.appSecret,
      clientKey: cfg.clientKey ?? defaultDouyinConfig.clientKey,
      clientSecret: cfg.clientSecret ?? defaultDouyinConfig.clientSecret,
      callbackUrl: cb,
      authScope: scope,
    } as DouyinConfig;
  }, [platform.config]);

  const [formValues, setFormValues] = useState<DouyinConfig>(initialFormValues);
  useEffect(() => { setFormValues(initialFormValues); }, [initialFormValues]);

  const handleChange = (patch: Partial<DouyinConfig>) => {
    setFormValues(v => ({ ...v, ...patch }));
    const { callbackUrl, ...rest } = { ...formValues, ...patch };
    const toSave: Partial<PlatformConfig> = {
      ...(rest.appId !== undefined ? { appId: rest.appId } : {}),
      ...(rest.appSecret !== undefined ? { appSecret: rest.appSecret } : {}),
      ...(rest.clientKey !== undefined ? { clientKey: rest.clientKey } : {}),
      ...(rest.clientSecret !== undefined ? { clientSecret: rest.clientSecret } : {}),
      ...(rest.authScope !== undefined ? { authScope: rest.authScope } : {}),
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

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
      showSuccess(showToast, t('platforms.douyin.messages.saveSuccess', 'Saved Successfully'), t('platforms.douyin.messages.saveSuccessMessage', 'Douyin platform configuration has been saved'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const displayName = platform.display_name || platform.name;

  return (
    <main className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {t('platforms.douyin.title', '{{name}} - Douyin Platform Configuration', { name: displayName })}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('platforms.douyin.subtitle', 'Configure Douyin Open Platform credentials and callback information.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={isUpdating || isDeleting}
            onClick={() => setConfirmOpen(true)}
            className={`px-3 py-1.5 text-sm rounded-md ${isDeleting ? 'bg-red-400 text-white' : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600'}`}
          >
            {isDeleting ? t('platforms.douyin.buttons.deleting', 'Deleting...') : t('platforms.douyin.buttons.delete', 'Delete')}
          </button>
          <button
            disabled={isUpdating || isDeleting || isToggling}
            onClick={async () => {
              if (isToggling) return;
              setIsToggling(true);
              try {
                if (isEnabled) {
                  await disablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.douyin.messages.platformDisabled', 'Platform Disabled'));
                } else {
                  await enablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.douyin.messages.platformEnabled', 'Platform Enabled'));
                }
              } catch (e) {
                showApiError(showToast, e);
              } finally {
                setIsToggling(false);
              }
            }}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${isEnabled ? 'bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'} ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isToggling
              ? (isEnabled ? t('platforms.douyin.buttons.disabling', 'Disabling...') : t('platforms.douyin.buttons.enabling', 'Enabling...'))
              : (isEnabled ? t('platforms.douyin.buttons.disable', 'Disable') : t('platforms.douyin.buttons.enable', 'Enable'))}
          </button>
          <button
            disabled={!canSave || isUpdating}
            onClick={handleSave}
            className={`px-3 py-1.5 text-sm rounded-md ${canSave ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
          >
            {isUpdating ? t('platforms.douyin.buttons.saving', 'Saving...') : t('platforms.douyin.buttons.save', 'Save')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 p-6">
        {/* Left: form */}
        <section className="lg:w-2/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 space-y-4 overflow-y-auto min-h-0 auto-hide-scrollbar">
          {/* Platform name */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('platforms.douyin.form.platformName', 'Platform Name')}
            </label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={t('platforms.douyin.form.platformNamePlaceholder', 'Please enter platform name')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          {/* App ID */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('platforms.douyin.form.appId', 'App ID')}
            </label>
            <input
              type="text"
              value={formValues.appId}
              onChange={(e) => handleChange({ appId: e.target.value })}
              placeholder={t('platforms.douyin.form.appIdPlaceholder', 'e.g., your_app_id')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          {/* App Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('platforms.douyin.form.appSecret', 'App Secret')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showAppSecret ? 'text' : 'password'}
                value={formValues.appSecret}
                onChange={(e) => handleChange({ appSecret: e.target.value })}
                placeholder={showAppSecret ? t('platforms.douyin.form.appSecretPlaceholder', 'Please enter App Secret') : '********'}
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={() => setShowAppSecret(v => !v)}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                {showAppSecret ? t('platforms.douyin.buttons.hide', 'Hide') : t('platforms.douyin.buttons.show', 'Show')}
              </button>
            </div>
          </div>

          {/* Client Key */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('platforms.douyin.form.clientKey', 'Client Key')}
            </label>
            <input
              type="text"
              value={formValues.clientKey}
              onChange={(e) => handleChange({ clientKey: e.target.value })}
              placeholder={t('platforms.douyin.form.clientKeyPlaceholder', 'e.g., your_client_key')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('platforms.douyin.form.clientSecret', 'Client Secret')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showClientSecret ? 'text' : 'password'}
                value={formValues.clientSecret}
                onChange={(e) => handleChange({ clientSecret: e.target.value })}
                placeholder={showClientSecret ? t('platforms.douyin.form.clientSecretPlaceholder', 'Please enter Client Secret') : '********'}
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={() => setShowClientSecret(v => !v)}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                {showClientSecret ? t('platforms.douyin.buttons.hide', 'Hide') : t('platforms.douyin.buttons.show', 'Show')}
              </button>
            </div>
          </div>

          {/* Callback URL (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('platforms.douyin.form.callbackUrl', 'Callback URL')}
            </label>
            <input
              type="text"
              value={formValues.callbackUrl}
              readOnly
              placeholder={t('platforms.douyin.form.callbackUrlPlaceholder', 'Callback URL will be generated after platform creation')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md bg-gray-100/70 dark:bg-gray-700/50 dark:text-gray-200 focus:outline-none font-mono"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('platforms.douyin.form.callbackUrlHint', 'Configure this URL in Douyin Open Platform \'Callback Address\' settings.')}
            </p>
          </div>

          {/* Authorization scope */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('platforms.douyin.form.authScope', 'Authorization Scope')}
            </label>
            <input
              type="text"
              value={formValues.authScope}
              onChange={(e) => handleChange({ authScope: e.target.value })}
              placeholder={t('platforms.douyin.form.authScopePlaceholder', 'e.g., user_info,video.list')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('platforms.douyin.form.authScopeHint', 'Separate multiple permissions with commas, e.g., user_info,video.list.')}
            </p>
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
        </section>

        {/* Right: comprehensive guide */}
        <section className="lg:w-3/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 min-h-0 overflow-y-auto auto-hide-scrollbar space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {t('platforms.douyin.guide.title', 'Douyin Open Platform Configuration Guide')}
          </h3>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm rounded-md p-3">
            <p className="font-medium">{t('platforms.douyin.guide.overview', 'Quick Overview')}</p>
            <p className="mt-1">
              {t('platforms.douyin.guide.overviewText', 'Complete the following four steps: ① Register Open Platform account → ② Create application and get credentials → ③ Configure callback address → ④ Save and test.')}
            </p>
          </div>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">
              {t('platforms.douyin.guide.step1Title', '1️⃣ Register Douyin Open Platform Account')}
            </summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li dangerouslySetInnerHTML={{ __html: t('platforms.douyin.guide.step1Item1', 'Visit <a class="text-blue-600 hover:underline" href="https://developer.open-douyin.com/" target="_blank" rel="noreferrer">Douyin Open Platform</a> and complete account registration and entity authentication (if required).') }} />
                <li>{t('platforms.douyin.guide.step1Item2', 'Log in to the console and complete developer information.')}</li>
              </ol>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">
              {t('platforms.douyin.guide.step2Title', '2️⃣ Create Application and Get Credentials')}
            </summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t('platforms.douyin.guide.step2Item1', 'Create a new application in the console and note down the App ID and App Secret.')}</li>
                <li>{t('platforms.douyin.guide.step2Item2', 'Get Client Key and Client Secret in application settings.')}</li>
                <li>{t('platforms.douyin.guide.step2Item3', 'Select and enable the required authorization scope (Scope) according to business needs.')}</li>
              </ol>
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs dark:text-gray-300">
                <pre className="font-mono overflow-x-auto">{`APP_ID=your_app_id
APP_SECRET=your_app_secret
CLIENT_KEY=your_client_key
CLIENT_SECRET=your_client_secret
AUTH_SCOPE=user_info,video.list`}</pre>
              </div>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">
              {t('platforms.douyin.guide.step3Title', '3️⃣ Configure Callback Address')}
            </summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t('platforms.douyin.guide.step3Item1', 'Configure the callback URL in the Open Platform \'Callback Settings\': use the read-only callback URL above.')}</li>
                <li>{t('platforms.douyin.guide.step3Item2', 'Ensure the server is publicly accessible and correctly handles verification requests.')}</li>
              </ol>
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs dark:text-gray-300">
                <pre className="font-mono overflow-x-auto">{`CALLBACK_URL=https://your-domain.com/api/douyin/callback/{platformId}`}</pre>
              </div>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">
              {t('platforms.douyin.guide.step4Title', '4️⃣ Common Issues and Troubleshooting')}
            </summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>{t('platforms.douyin.guide.step4Item1', 'Callback verification failed: Check if the callback URL is accessible and if the TLS certificate is valid.')}</li>
                <li>{t('platforms.douyin.guide.step4Item2', 'Insufficient permissions: Confirm that the required Scope has been enabled and authorized in the Open Platform.')}</li>
                <li>{t('platforms.douyin.guide.step4Item3', 'Credential error: Verify that App ID/Secret and Client Key/Secret are entered correctly.')}</li>
              </ul>
              <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://developer.open-douyin.com/" target="_blank" rel="noreferrer">{t('platforms.douyin.docsLink', 'Douyin Open Platform documentation')}</a>
            </div>
          </details>

          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200 text-sm rounded-md p-3">
            <p className="font-semibold">{t('platforms.douyin.guide.bestPracticesTitle', 'Best Practices')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>{t('platforms.douyin.guide.bestPracticesItem1', 'Store keys in a secure key management service (such as KMS/Vault) to avoid appearing in the code repository.')}</li>
              <li>{t('platforms.douyin.guide.bestPracticesItem2', 'Use different callbacks and credentials for different environments (development/testing/production), with minimum authorization as needed.')}</li>
              <li>{t('platforms.douyin.guide.bestPracticesItem3', 'Regularly rotate keys and minimize permission scope (Scope).')}</li>
            </ul>
          </div>
        </section>
      </div>

      {/* Scoped scrollbar style */}
      <style>{`
        .auto-hide-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.3) transparent; }
        .auto-hide-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .auto-hide-scrollbar::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 4px; }
        .auto-hide-scrollbar:hover::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.35); }
      `}</style>
      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('platforms.douyin.confirm.deleteTitle', 'Delete Platform')}
        message={t('platforms.douyin.confirm.deleteMessage', 'Are you sure you want to delete this platform?')}
        confirmText={t('platforms.douyin.confirm.confirmText', 'Delete')}
        cancelText={t('platforms.douyin.confirm.cancelText', 'Cancel')}
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
            showSuccess(showToast, t('platforms.douyin.messages.deleteSuccess', 'Platform Deleted'), t('platforms.douyin.messages.deleteSuccessMessage', 'Platform has been deleted'));
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

export default DouyinPlatformConfig;

