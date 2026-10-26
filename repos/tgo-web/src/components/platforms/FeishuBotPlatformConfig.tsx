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
  platform: Platform; // expected: platform.type === 'feishu_bot'
}

const FeishuBotPlatformConfig: React.FC<Props> = ({ platform }) => {
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
    appId: (platform.config as any)?.app_id ?? '',
    appSecret: (platform.config as any)?.app_secret ?? '',
    encryptKey: (platform.config as any)?.encrypt_key ?? '',
    verificationToken: (platform.config as any)?.verification_token ?? '',
    // Convert relative callback URL to absolute
    callbackUrl: toAbsoluteUrl((platform as any)?.callback_url ?? ''),
  }));

  useEffect(() => {
    setFormValues({
      appId: (platform.config as any)?.app_id ?? '',
      appSecret: (platform.config as any)?.app_secret ?? '',
      encryptKey: (platform.config as any)?.encrypt_key ?? '',
      verificationToken: (platform.config as any)?.verification_token ?? '',
      // Convert relative callback URL to absolute
      callbackUrl: toAbsoluteUrl((platform as any)?.callback_url ?? ''),
    });
  }, [platform]);

  const handleChange = (patch: Partial<typeof formValues>) => {
    setFormValues(v => ({ ...v, ...patch }));
    const { callbackUrl, ...rest } = { ...formValues, ...patch };
    // Write changes to store; callbackUrl is derived from backend (callback_url)
    const toSave: Partial<PlatformConfig> = {
      ...(rest.appId !== undefined ? { appId: rest.appId } : {}),
      ...(rest.appSecret !== undefined ? { appSecret: rest.appSecret } : {}),
      ...(rest.encryptKey !== undefined ? { encryptKey: rest.encryptKey } : {}),
      ...(rest.verificationToken !== undefined ? { verificationToken: rest.verificationToken } : {}),
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};

      if (hasConfigChanges) {
        // Transform camelCase form values to snake_case API payload for Feishu Bot
        updates.config = {
          app_id: (formValues.appId || '').trim(),
          app_secret: (formValues.appSecret || '').trim(),
          encrypt_key: (formValues.encryptKey || '').trim(),
          verification_token: (formValues.verificationToken || '').trim(),
        } as any;
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
      showSuccess(showToast, t('platforms.feishuBot.messages.saveSuccess', 'Saved Successfully'), t('platforms.feishuBot.messages.saveSuccessMessage', 'Feishu Bot configuration has been updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const displayName = platform.display_name || platform.name;

  return (
    <main className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('platforms.feishuBot.header.title', { name: displayName, defaultValue: '{{name}} Config' })}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('platforms.feishuBot.header.subtitle', 'Configure credentials and callbacks for Feishu Bot integration.')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={isUpdating || isDeleting}
            onClick={() => setConfirmOpen(true)}
            className={`px-3 py-1.5 text-sm rounded-md ${isDeleting ? 'bg-red-400 text-white' : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600'}`}
          >
            {isDeleting ? t('platforms.feishuBot.buttons.deleting', 'Deleting...') : t('platforms.feishuBot.buttons.delete', 'Delete')}
          </button>
          <button
            disabled={isUpdating || isDeleting || isToggling}
            onClick={async () => {
              if (isToggling) return;
              setIsToggling(true);
              try {
                if (isEnabled) {
                  await disablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.feishuBot.messages.disabled', 'Platform disabled'));
                } else {
                  await enablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.feishuBot.messages.enabled', 'Platform enabled'));
                }
              } catch (e) {
                showApiError(showToast, e);
              } finally {
                setIsToggling(false);
              }
            }}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${isEnabled ? 'bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'} ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isToggling ? (isEnabled ? t('platforms.feishuBot.buttons.disabling', 'Disabling...') : t('platforms.feishuBot.buttons.enabling', 'Enabling...')) : (isEnabled ? t('platforms.feishuBot.buttons.disable', 'Disable') : t('platforms.feishuBot.buttons.enable', 'Enable'))}
          </button>

          <button
            disabled={!canSave || isUpdating}
            onClick={handleSave}
            className={`px-3 py-1.5 text-sm rounded-md ${canSave ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
          >
            {isUpdating ? t('platforms.feishuBot.buttons.saving', 'Saving...') : t('platforms.feishuBot.buttons.save', 'Save')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 p-6">
        {/* Left: form */}
        <section className="lg:w-2/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 space-y-4 overflow-y-auto min-h-0 auto-hide-scrollbar">
          {/* Platform name */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.feishuBot.form.name', 'Platform Name')}</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={t('platforms.feishuBot.form.namePlaceholder', 'Please enter platform name')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          {/* Callback URL (read-only; enter it in Feishu) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.feishuBot.form.callbackUrl', 'Request URL')}</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formValues.callbackUrl}
                readOnly
                placeholder={t('platforms.feishuBot.form.callbackUrlPlaceholder', 'Request URL will be generated after creation')}
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md bg-gray-100/70 dark:bg-gray-700/50 dark:text-gray-200 focus:outline-none font-mono"
              />
              <button
                type="button"
                disabled={!formValues.callbackUrl}
                onClick={async () => {
                  try {
                    if (!formValues.callbackUrl) return;
                    await navigator.clipboard.writeText(formValues.callbackUrl);
                    showSuccess(showToast, t('platforms.feishuBot.messages.urlCopied', 'Request URL copied'));
                  } catch (e) {
                    showApiError(showToast, e);
                  }
                }}
                className={`px-2 py-1 text-xs rounded-md ${formValues.callbackUrl ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
              >
                {t('platforms.feishuBot.buttons.copy', 'Copy')}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.feishuBot.form.callbackUrlHint', 'Fill this URL into the \'Request URL\' in Feishu Bot configuration.')}</p>
          </div>

          {/* App ID */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.feishuBot.form.appId', 'App ID')}</label>
            <input
              type="text"
              value={formValues.appId}
              onChange={(e) => handleChange({ appId: e.target.value })}
              placeholder={t('platforms.feishuBot.form.appIdPlaceholder', 'Feishu App ID')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.feishuBot.form.appIdHint', 'Found in \'Credentials & Basic Info\' of the app details on Feishu Open Platform.')}</p>
          </div>

          {/* App Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.feishuBot.form.appSecret', 'App Secret')}</label>
            <input
              type="password"
              value={formValues.appSecret}
              onChange={(e) => handleChange({ appSecret: e.target.value })}
              placeholder={t('platforms.feishuBot.form.appSecretPlaceholder', 'Feishu App Secret')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.feishuBot.form.appSecretHint', 'Found in \'Credentials & Basic Info\' on Feishu Open Platform, keep it safe.')}</p>
          </div>

          {/* Encrypt Key (encryption key) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.feishuBot.form.encryptKey', 'Encrypt Key')}</label>
            <input
              type="text"
              value={formValues.encryptKey}
              onChange={(e) => handleChange({ encryptKey: e.target.value })}
              placeholder={t('platforms.feishuBot.form.encryptKeyPlaceholder', 'Encryption key from Feishu Open Platform')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.feishuBot.form.encryptKeyHint', 'Used to decrypt event messages from Feishu, obtain from Open Platform.')}</p>
          </div>

          {/* Verification Token */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.feishuBot.form.verificationToken', 'Verification Token')}</label>
            <input
              type="text"
              value={formValues.verificationToken}
              onChange={(e) => handleChange({ verificationToken: e.target.value })}
              placeholder={t('platforms.feishuBot.form.verificationTokenPlaceholder', 'Verification token from Feishu Open Platform')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.feishuBot.form.verificationTokenHint', 'Used to verify event subscription request source, obtain from Open Platform.')}</p>
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
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('platforms.feishuBot.guide.title', 'Feishu Bot Configuration Guide')}</h3>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm rounded-md p-3">
            <p className="font-medium">{t('platforms.feishuBot.guide.overview', 'Quick Overview')}</p>
            <p className="mt-1">{t('platforms.feishuBot.guide.overviewText', 'Complete three steps: ① Create app/robot on Feishu Open Platform → ② Configure request URL and get Encrypt Key/Verification Token → ③ Fill information back here and save.')}</p>
          </div>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50" open>
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.feishuBot.guide.step1Title', '1️⃣ Create Feishu App/Robot')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li dangerouslySetInnerHTML={{ __html: t('platforms.feishuBot.guide.step1Item1', 'Visit <a class="text-blue-600 hover:underline" href="https://open.feishu.cn/app" target="_blank" rel="noreferrer">Feishu Open Platform</a>, log in and enter developer backend.') }} />
                <li>{t('platforms.feishuBot.guide.step1Item2', 'Click \'Create Custom App\', fill in name and description.')}</li>
                <li>{t('platforms.feishuBot.guide.step1Item3', 'Go to app details, find \'Robot\' in left menu, and enable robot capability.')}</li>
              </ol>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.feishuBot.guide.step2Title', '2️⃣ Configure Event Subscription')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t('platforms.feishuBot.guide.step2Item1', 'In app details, enter \'Event Subscription\'.')}</li>
                <li>{t('platforms.feishuBot.guide.step2Item2', 'Copy the \'Request URL\' from the left and paste it into Feishu.')}</li>
                <li>{t('platforms.feishuBot.guide.step2Item3', 'Find \'Encrypt Key\' and \'Verification Token\' on the page, copy and fill them on the left.')}</li>
                <li>{t('platforms.feishuBot.guide.step2Item4', 'Add required events, e.g., \'Receive Messages\' (im.message.receive_v1).')}</li>
              </ol>
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-2 text-xs text-yellow-800 dark:text-yellow-200">
                <p className="font-semibold">{t('platforms.feishuBot.guide.step2SecurityTitle', 'Security Tip')}</p>
                <p>{t('platforms.feishuBot.guide.step2SecurityText', 'Keep Encrypt Key and Verification Token safe; they are used for verification and decryption.')}</p>
              </div>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.feishuBot.guide.step3Title', '3️⃣ Publish App')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t('platforms.feishuBot.guide.step3Item1', 'Click \'Save\' on this platform.')}</li>
                <li>{t('platforms.feishuBot.guide.step3Item2', 'Go back to Feishu, click \'Version Management & Release\' → \'Create Version\'.')}</li>
                <li>{t('platforms.feishuBot.guide.step3Item3', 'Submit for review; it will be ready after admin approval.')}</li>
              </ol>
              <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://open.feishu.cn/document/home/develop-a-bot-in-5-minutes/create-an-app" target="_blank" rel="noreferrer">{t('platforms.feishuBot.guide.docsLink', 'Feishu Bot Dev Docs')}</a>
            </div>
          </details>

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
        title={t('platforms.feishuBot.dialog.deleteTitle', 'Confirm Delete')}
        message={t('platforms.feishuBot.dialog.deleteMessage', 'Are you sure you want to delete this Feishu Bot platform? This action cannot be undone.')}
        confirmText={t('platforms.feishuBot.dialog.confirmDelete', 'Delete')}
        cancelText={t('platforms.feishuBot.dialog.cancel', 'Cancel')}
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
            showSuccess(showToast, t('platforms.feishuBot.messages.deleteSuccess', 'Deleted Successfully'), t('platforms.feishuBot.messages.deleteSuccessMessage', 'Feishu Bot platform has been deleted'));
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

export default FeishuBotPlatformConfig;

