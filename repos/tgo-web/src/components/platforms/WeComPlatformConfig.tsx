import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import type { Platform, PlatformConfig, PlatformAIMode } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import { toAbsoluteUrl } from '@/utils/config';

interface Props {
  platform: Platform; // expected: platform.type === 'wecom'
}

const WeComPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore(s => s.resetPlatformConfig);
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
  const [formValues, setFormValues] = useState(() => ({
    corpId: (platform.config as any)?.corp_id ?? '',
    agentId: (platform.config as any)?.agent_id ?? '',
    appSecret: (platform.config as any)?.app_secret ?? '',
    token: (platform.config as any)?.token ?? '',
    encodingAESKey: (platform.config as any)?.encoding_aes_key ?? '',
    // Convert relative callback URL to absolute
    callbackUrl: toAbsoluteUrl((platform as any)?.callback_url ?? ''),
  }));

  useEffect(() => {
    setFormValues({
      corpId: (platform.config as any)?.corp_id ?? '',
      agentId: (platform.config as any)?.agent_id ?? '',
      appSecret: (platform.config as any)?.app_secret ?? '',
      token: (platform.config as any)?.token ?? '',
      encodingAESKey: (platform.config as any)?.encoding_aes_key ?? '',
      // Convert relative callback URL to absolute
      callbackUrl: toAbsoluteUrl((platform as any)?.callback_url ?? ''),
    });
  }, [platform]);

  const handleChange = (patch: Partial<typeof formValues>) => {
    setFormValues(v => ({ ...v, ...patch }));
    const { callbackUrl, ...rest } = { ...formValues, ...patch };
    // Write changes to store; callbackUrl is derived from backend (callback_url)
    const toSave: Partial<PlatformConfig> = {
      ...(rest.corpId !== undefined ? { corpId: rest.corpId } : {}),
      ...(rest.agentId !== undefined ? { agentId: rest.agentId } : {}),
      ...(rest.appSecret !== undefined ? { appSecret: rest.appSecret } : {}),
      ...(rest.token !== undefined ? { token: rest.token } : {}),
      ...(rest.encodingAESKey !== undefined ? { encodingAESKey: rest.encodingAESKey } : {}),
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const [showSecret, setShowSecret] = useState(false);

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};

      if (hasConfigChanges) {
        // Transform camelCase form values to snake_case API payload for WeCom
        const snakeConfig: Record<string, any> = {
          corp_id: (formValues.corpId || '').trim(),
          agent_id: (formValues.agentId || '').trim(),
          app_secret: (formValues.appSecret || '').trim(),
          token: (formValues.token || '').trim(),
        };
        const aes = (formValues.encodingAESKey || '').trim();
        if (aes) {
          snakeConfig.encoding_aes_key = aes;
        } else {
          snakeConfig.encoding_aes_key = null;
        }
        updates.config = snakeConfig;
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
        if (hasConfigChanges) {
          resetPlatformConfig(platform.id);
        }
      }
      showSuccess(showToast, t('platforms.wecom.messages.saveSuccess', 'Saved Successfully'), t('platforms.wecom.messages.saveSuccessMessage', 'WeCom platform configuration has been updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const displayName = platform.display_name || platform.name;

  return (
    <main className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('platforms.wecom.header.title', { name: displayName })}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('platforms.wecom.header.subtitle', 'Configure credentials and callbacks for WeCom integration.')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={isUpdating || isDeleting}
            onClick={() => setConfirmOpen(true)}
            className={`px-3 py-1.5 text-sm rounded-md ${isDeleting ? 'bg-red-400 text-white' : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600'}`}
          >
            {isDeleting ? t('platforms.wecom.buttons.deleting', 'Deleting...') : t('platforms.wecom.buttons.delete', 'Delete')}
          </button>
          <button
            disabled={isUpdating || isDeleting || isToggling}
            onClick={async () => {
              if (isToggling) return;
              setIsToggling(true);
              try {
                if (isEnabled) {
                  await disablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.wecom.messages.disabled', 'Platform disabled'));
                } else {
                  await enablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.wecom.messages.enabled', 'Platform enabled'));
                }
              } catch (e) {
                showApiError(showToast, e);
              } finally {
                setIsToggling(false);
              }
            }}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${isEnabled ? 'bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'} ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isToggling ? (isEnabled ? t('platforms.wecom.buttons.disabling', 'Disabling...') : t('platforms.wecom.buttons.enabling', 'Enabling...')) : (isEnabled ? t('platforms.wecom.buttons.disable', 'Disable') : t('platforms.wecom.buttons.enable', 'Enable'))}
          </button>

          <button
            disabled={!canSave || isUpdating}
            onClick={handleSave}
            className={`px-3 py-1.5 text-sm rounded-md ${canSave ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
          >
            {isUpdating ? t('platforms.wecom.buttons.saving', 'Saving...') : t('platforms.wecom.buttons.save', 'Save')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 p-6">
        {/* Left: form */}
        <section className="lg:w-2/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 space-y-4 overflow-y-auto min-h-0 auto-hide-scrollbar">
          {/* Platform name */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.wecom.form.name', 'Platform Name')}</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={t('platforms.wecom.form.namePlaceholder', 'Please enter platform name')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          {/* Corp ID (CorpID) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.wecom.form.corpId', 'CorpID')}</label>
            <input
              type="text"
              value={formValues.corpId}
              onChange={(e) => handleChange({ corpId: e.target.value })}
              placeholder={t('platforms.wecom.form.corpIdPlaceholder', 'e.g.: ww1234567890abcdef')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.wecom.form.corpIdHint', 'Can be found in \'My Company\' - \'Company Information\'.')}</p>
          </div>

          {/* App AgentId */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.wecom.form.agentId', 'AgentId')}</label>
            <input
              type="text"
              value={formValues.agentId}
              onChange={(e) => handleChange({ agentId: e.target.value })}
              placeholder={t('platforms.wecom.form.agentIdPlaceholder', 'e.g.: 1000002')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.wecom.form.agentIdHint', 'Obtain from the application details page in the WeCom management backend.')}</p>
          </div>

          {/* App Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.wecom.form.appSecret', 'App Secret')}</label>
            <div className="flex items-center gap-2">
              <input
                type={showSecret ? 'text' : 'password'}
                value={formValues.appSecret}
                onChange={(e) => handleChange({ appSecret: e.target.value })}
                placeholder={showSecret ? t('platforms.wecom.form.appSecretPlaceholder', 'Please enter App Secret') : '********'}
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                {showSecret ? t('platforms.wecom.buttons.hide', 'Hide') : t('platforms.wecom.buttons.show', 'Show')}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.wecom.form.appSecretHint', 'Used as credentials for calling WeCom interfaces, keep it safe.')}</p>
          </div>

          {/* Token */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.wecom.form.token', 'Token')}</label>
            <input
              type="text"
              value={formValues.token}
              onChange={(e) => handleChange({ token: e.target.value })}
              placeholder={t('platforms.wecom.form.tokenPlaceholder', 'Token for callback verification')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.wecom.form.tokenHint', 'Must match the Token in the WeCom callback configuration.')}</p>
          </div>

          {/* EncodingAESKey */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.wecom.form.encodingAESKey', 'EncodingAESKey')}</label>
            <input
              type="text"
              value={formValues.encodingAESKey}
              onChange={(e) => handleChange({ encodingAESKey: e.target.value })}
              placeholder={t('platforms.wecom.form.encodingAESKeyPlaceholder', '43-character message encryption key')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.wecom.form.encodingAESKeyHint', 'Used when the message encryption method is compatible/safe mode.')}</p>
          </div>

          {/* Callback URL (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.wecom.form.callbackUrl', 'Callback URL')}</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formValues.callbackUrl}
                readOnly
                placeholder={t('platforms.wecom.form.callbackUrlPlaceholder', 'Callback URL will be generated after creation')}
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md bg-gray-100/70 dark:bg-gray-700/50 dark:text-gray-200 focus:outline-none font-mono"
              />
              <button
                type="button"
                disabled={!formValues.callbackUrl}
                onClick={async () => {
                  try {
                    if (!formValues.callbackUrl) return;
                    await navigator.clipboard.writeText(formValues.callbackUrl);
                    showSuccess(showToast, t('platforms.wecom.messages.urlCopied', 'Callback URL copied'));
                  } catch (e) {
                    showApiError(showToast, e);
                  }
                }}
                className={`px-2 py-1 text-xs rounded-md ${formValues.callbackUrl ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
              >
                {t('platforms.wecom.buttons.copy', 'Copy')}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.wecom.form.callbackUrlHint', 'Set this URL as the callback address in WeCom \'Server Configuration\'.')}</p>
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
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('platforms.wecom.guide.title', 'WeCom Configuration Guide')}</h3>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm rounded-md p-3">
            <p className="font-medium">{t('platforms.wecom.guide.overview', 'Quick Overview')}</p>
            <p className="mt-1">{t('platforms.wecom.guide.overviewText', 'Complete these four steps: ① Find CorpID → ② Obtain AgentId/Secret → ③ Configure server callback (URL/Token/EncodingAESKey) → ④ Save and test.')}</p>
          </div>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.wecom.guide.step1Title', '1️⃣ Find CorpID')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li dangerouslySetInnerHTML={{ __html: t('platforms.wecom.guide.step1Item1', 'Log in to the <a class="text-blue-600 hover:underline" href="https://work.weixin.qq.com/wework_admin/frame" target="_blank" rel="noreferrer">WeCom management backend</a>.') }} />
                <li>{t('platforms.wecom.guide.step1Item2', 'Go to \'My Company\' → \'Company Information\'.')}</li>
                <li>{t('platforms.wecom.guide.step1Item3', 'Copy the \'CorpID\' and paste it into the \'CorpID\' field on the left.')}</li>
              </ol>
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs dark:text-gray-300">
                <pre className="font-mono overflow-x-auto">{t('platforms.wecom.guide.step1Example', 'Example: ww1234567890abcdef')}</pre>
              </div>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.wecom.guide.step2Title', '2️⃣ Obtain AgentId and App Secret')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t('platforms.wecom.guide.step2Item1', 'Select \'App Management\' on the left and open your self-built app.')}</li>
                <li>{t('platforms.wecom.guide.step2Item2', 'You can see the \'AgentId\' on the app details page.')}</li>
                <li>{t('platforms.wecom.guide.step2Item3', 'Click \'Secret\' to show or reset, copy and fill into the \'App Secret\' field on the left.')}</li>
              </ol>
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-2 text-xs text-yellow-800 dark:text-yellow-200">
                <p className="font-semibold">{t('platforms.wecom.guide.step2SecurityTitle', 'Security Tip')}</p>
                <p>{t('platforms.wecom.guide.step2SecurityText', 'Keep the Secret safe and do not leak it; use minimum permissions and rotate regularly in production.')}</p>
              </div>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.wecom.guide.step3Title', '3️⃣ Configure Server Callback (URL / Token / EncodingAESKey)')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-3">
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t('platforms.wecom.guide.step3Item1', 'In \'App Management\' → your app → \'Receive Messages\', click \'Set\' to enter \'API Receive Messages\'.')}</li>
                <li>{t('platforms.wecom.guide.step3Item2', 'URL: Copy the Callback URL (read-only) from the left and paste it into the console;')}</li>
                <li>{t('platforms.wecom.guide.step3Item3', 'Token: Customize any string and ensure it matches the left field;')}</li>
                <li>{t('platforms.wecom.guide.step3Item4', 'EncodingAESKey: Click to generate a 43-character key and copy it to the left field;')}</li>
                <li>{t('platforms.wecom.guide.step3Item5', 'Encryption Method: \'Compatible\' or \'Safe\' mode is recommended.')}</li>
              </ol>
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('platforms.wecom.guide.step3ExampleTitle', 'Example Placeholder (for reference only)')}</h4>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs dark:text-gray-300">
                  <pre className="font-mono overflow-x-auto">{`URL:    https://your-domain.com/api/wecom/callback/{platformId}
Token:  your_token_string
AESKey: your_43_chars_encoding_aes_key`}</pre>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded p-2 text-xs text-blue-800 dark:text-blue-200">
                <p>{t('platforms.wecom.guide.step3Note', 'After saving, WeCom will perform URL verification. Ensure your server returns the correct verification response.')}</p>
              </div>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.wecom.guide.step4Title', '4️⃣ Troubleshooting')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>{t('platforms.wecom.guide.step4Item1', 'URL verification failed: Check if your callback service is accessible from the public internet and if the TLS certificate is valid.')}</li>
                <li>{t('platforms.wecom.guide.step4Item2', 'Decryption failed: Confirm the EncodingAESKey is correct and contains no extra spaces.')}</li>
                <li>{t('platforms.wecom.guide.step4Item3', '403/Permission issues: Confirm the app is enabled and granted required permissions; regenerate Secret if necessary.')}</li>
              </ul>
              <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://developer.work.weixin.qq.com/document/path/90968" target="_blank" rel="noreferrer">{t('platforms.wecom.guide.docsLink', 'WeCom Message Callback Dev Docs')}</a>
            </div>
          </details>

          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200 text-sm rounded-md p-3">
            <p className="font-semibold">{t('platforms.wecom.guide.bestPracticesTitle', 'Best Practices')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>{t('platforms.wecom.guide.bestPracticesItem1', 'Store Secrets in a key management service (like Vault, KMS) instead of plaintext in code.')}</li>
              <li>{t('platforms.wecom.guide.bestPracticesItem2', 'Use different Token/AESKey for different environments (Dev/Test/Prod).')}</li>
              <li>{t('platforms.wecom.guide.bestPracticesItem3', 'Rotate Secrets regularly and update server configuration before expiration.')}</li>
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
        title={t('platforms.wecom.confirm.deleteTitle', 'Delete Platform')}
        message={t('platforms.wecom.confirm.deleteMessage', 'Are you sure you want to delete this platform?')}
        confirmText={t('platforms.wecom.confirm.confirmText', 'Delete')}
        cancelText={t('platforms.wecom.confirm.cancelText', 'Cancel')}
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
            showSuccess(showToast, t('platforms.wecom.messages.deleteSuccess', 'Deleted Successfully'), t('platforms.wecom.messages.deleteSuccessMessage', 'WeCom platform has been deleted'));
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

export default WeComPlatformConfig;
