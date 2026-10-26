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
  platform: Platform; // expected: platform.type === 'dingtalk_bot'
}

const DingTalkBotPlatformConfig: React.FC<Props> = ({ platform }) => {
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
    appKey: (platform.config as any)?.app_key ?? '',
    appSecret: (platform.config as any)?.app_secret ?? '',
    robotCode: (platform.config as any)?.robot_code ?? '',
    aesKey: (platform.config as any)?.aes_key ?? '',
    token: (platform.config as any)?.token ?? '',
    // Convert relative callback URL to absolute
    callbackUrl: toAbsoluteUrl((platform as any)?.callback_url ?? ''),
  }));

  useEffect(() => {
    setFormValues({
      appKey: (platform.config as any)?.app_key ?? '',
      appSecret: (platform.config as any)?.app_secret ?? '',
      robotCode: (platform.config as any)?.robot_code ?? '',
      aesKey: (platform.config as any)?.aes_key ?? '',
      token: (platform.config as any)?.token ?? '',
      // Convert relative callback URL to absolute
      callbackUrl: toAbsoluteUrl((platform as any)?.callback_url ?? ''),
    });
  }, [platform]);

  const handleChange = (patch: Partial<typeof formValues>) => {
    setFormValues(v => ({ ...v, ...patch }));
    const { callbackUrl, ...rest } = { ...formValues, ...patch };
    // Write changes to store; callbackUrl is derived from backend (callback_url)
    const toSave: Partial<PlatformConfig> = {
      ...(rest.appKey !== undefined ? { appKey: rest.appKey } : {}),
      ...(rest.appSecret !== undefined ? { appSecret: rest.appSecret } : {}),
      ...(rest.robotCode !== undefined ? { robotCode: rest.robotCode } : {}),
      ...(rest.aesKey !== undefined ? { aesKey: rest.aesKey } : {}),
      ...(rest.token !== undefined ? { token: rest.token } : {}),
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};

      if (hasConfigChanges) {
        // Transform camelCase form values to snake_case API payload for DingTalk Bot
        updates.config = {
          app_key: (formValues.appKey || '').trim(),
          app_secret: (formValues.appSecret || '').trim(),
          robot_code: (formValues.robotCode || '').trim(),
          aes_key: (formValues.aesKey || '').trim(),
          token: (formValues.token || '').trim(),
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
      showSuccess(showToast, t('platforms.dingtalkBot.messages.saveSuccess', 'Saved Successfully'), t('platforms.dingtalkBot.messages.saveSuccessMessage', 'DingTalk Bot configuration has been updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const displayName = platform.display_name || platform.name;

  return (
    <main className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('platforms.dingtalkBot.header.title', { name: displayName, defaultValue: '{{name}} Config' })}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('platforms.dingtalkBot.header.subtitle', 'Configure credentials and callbacks for DingTalk Bot integration.')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={isUpdating || isDeleting}
            onClick={() => setConfirmOpen(true)}
            className={`px-3 py-1.5 text-sm rounded-md ${isDeleting ? 'bg-red-400 text-white' : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600'}`}
          >
            {isDeleting ? t('platforms.dingtalkBot.buttons.deleting', 'Deleting...') : t('platforms.dingtalkBot.buttons.delete', 'Delete')}
          </button>
          <button
            disabled={isUpdating || isDeleting || isToggling}
            onClick={async () => {
              if (isToggling) return;
              setIsToggling(true);
              try {
                if (isEnabled) {
                  await disablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.dingtalkBot.messages.disabled', 'Platform disabled'));
                } else {
                  await enablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.dingtalkBot.messages.enabled', 'Platform enabled'));
                }
              } catch (e) {
                showApiError(showToast, e);
              } finally {
                setIsToggling(false);
              }
            }}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${isEnabled ? 'bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'} ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isToggling ? (isEnabled ? t('platforms.dingtalkBot.buttons.disabling', 'Disabling...') : t('platforms.dingtalkBot.buttons.enabling', 'Enabling...')) : (isEnabled ? t('platforms.dingtalkBot.buttons.disable', 'Disable') : t('platforms.dingtalkBot.buttons.enable', 'Enable'))}
          </button>

          <button
            disabled={!canSave || isUpdating}
            onClick={handleSave}
            className={`px-3 py-1.5 text-sm rounded-md ${canSave ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
          >
            {isUpdating ? t('platforms.dingtalkBot.buttons.saving', 'Saving...') : t('platforms.dingtalkBot.buttons.save', 'Save')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 p-6">
        {/* Left: form */}
        <section className="lg:w-2/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 space-y-4 overflow-y-auto min-h-0 auto-hide-scrollbar">
          {/* Platform name */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.dingtalkBot.form.name', 'Platform Name')}</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={t('platforms.dingtalkBot.form.namePlaceholder', 'Please enter platform name')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          {/* Callback URL (read-only; enter it in DingTalk) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.dingtalkBot.form.callbackUrl', 'Message Receiver URL')}</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formValues.callbackUrl}
                readOnly
                placeholder={t('platforms.dingtalkBot.form.callbackUrlPlaceholder', 'Receiver URL will be generated after creation')}
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md bg-gray-100/70 dark:bg-gray-700/50 dark:text-gray-200 focus:outline-none font-mono"
              />
              <button
                type="button"
                disabled={!formValues.callbackUrl}
                onClick={async () => {
                  try {
                    if (!formValues.callbackUrl) return;
                    await navigator.clipboard.writeText(formValues.callbackUrl);
                    showSuccess(showToast, t('platforms.dingtalkBot.messages.urlCopied', 'Receiver URL copied'));
                  } catch (e) {
                    showApiError(showToast, e);
                  }
                }}
                className={`px-2 py-1 text-xs rounded-md ${formValues.callbackUrl ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
              >
                {t('platforms.dingtalkBot.buttons.copy', 'Copy')}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.dingtalkBot.form.callbackUrlHint', 'Fill this URL into the \'Message Receiver URL\' in DingTalk Bot configuration.')}</p>
          </div>

          {/* App Key */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.dingtalkBot.form.appKey', 'App Key')}</label>
            <input
              type="text"
              value={formValues.appKey}
              onChange={(e) => handleChange({ appKey: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.appKeyPlaceholder', 'DingTalk App Key')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.dingtalkBot.form.appKeyHint', 'Found in \'Credentials & Basic Info\' of the app details on DingTalk Open Platform.')}</p>
          </div>

          {/* App Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.dingtalkBot.form.appSecret', 'App Secret')}</label>
            <input
              type="password"
              value={formValues.appSecret}
              onChange={(e) => handleChange({ appSecret: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.appSecretPlaceholder', 'DingTalk App Secret')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.dingtalkBot.form.appSecretHint', 'Found in \'Credentials & Basic Info\' on DingTalk Open Platform, keep it safe.')}</p>
          </div>

          {/* Robot Code */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.dingtalkBot.form.robotCode', 'Robot Code')}</label>
            <input
              type="text"
              value={formValues.robotCode}
              onChange={(e) => handleChange({ robotCode: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.robotCodePlaceholder', 'Unique code for the DingTalk robot')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.dingtalkBot.form.robotCodeHint', 'Obtain from the robot configuration page on DingTalk Open Platform.')}</p>
          </div>

          {/* AES Key (encryption key) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.dingtalkBot.form.aesKey', 'AES Key')}</label>
            <input
              type="text"
              value={formValues.aesKey}
              onChange={(e) => handleChange({ aesKey: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.aesKeyPlaceholder', 'Key for message encryption/decryption')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.dingtalkBot.form.aesKeyHint', 'Used to decrypt event messages from DingTalk, obtain from Open Platform.')}</p>
          </div>

          {/* Token (signature verification token) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.dingtalkBot.form.token', 'Token')}</label>
            <input
              type="text"
              value={formValues.token}
              onChange={(e) => handleChange({ token: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.tokenPlaceholder', 'Token for signature verification')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.dingtalkBot.form.tokenHint', 'Used to verify event subscription request source, obtain from Open Platform.')}</p>
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
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('platforms.dingtalkBot.guide.title', 'DingTalk Bot Configuration Guide')}</h3>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm rounded-md p-3">
            <p className="font-medium">{t('platforms.dingtalkBot.guide.overview', 'Quick Overview')}</p>
            <p className="mt-1">{t('platforms.dingtalkBot.guide.overviewText', 'Complete three steps: ① Create app/robot on DingTalk Open Platform → ② Configure receiver URL and get credentials → ③ Fill information back here and save.')}</p>
          </div>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50" open>
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.dingtalkBot.guide.step1Title', '1️⃣ Create DingTalk App/Robot')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li dangerouslySetInnerHTML={{ __html: t('platforms.dingtalkBot.guide.step1Item1', 'Visit <a class="text-blue-600 hover:underline" href="https://open.dingtalk.com/developer" target="_blank" rel="noreferrer">DingTalk Open Platform</a>, log in and enter developer backend.') }} />
                <li>{t('platforms.dingtalkBot.guide.step1Item2', 'Click \'App Development\' → \'Internal Development\' → \'Create App\'.')}</li>
                <li>{t('platforms.dingtalkBot.guide.step1Item3', 'Fill in app name, description, etc., and confirm creation.')}</li>
                <li>{t('platforms.dingtalkBot.guide.step1Item4', 'In app details, find \'Robot\' and click \'Create Robot\'.')}</li>
              </ol>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.dingtalkBot.guide.step2Title', '2️⃣ Configure Receiver and Security')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t('platforms.dingtalkBot.guide.step2Item1', 'In robot configuration, find \'Message Receiver Mode\' and select \'HTTP Mode\'.')}</li>
                <li>{t('platforms.dingtalkBot.guide.step2Item2', 'Copy the \'Message Receiver URL\' from the left and paste it into DingTalk.')}</li>
                <li>{t('platforms.dingtalkBot.guide.step2Item3', 'In \'Credentials & Basic Info\', copy \'AppKey\' and \'AppSecret\' and fill them on the left.')}</li>
                <li>{t('platforms.dingtalkBot.guide.step2Item4', 'In robot configuration, copy \'RobotCode\' and fill it into \'Robot Code\' on the left.')}</li>
                <li>{t('platforms.dingtalkBot.guide.step2Item5', 'In \'Dev Config\' → \'Event Subscription\', copy \'AES Key\' and \'Token\' and fill them on the left.')}</li>
              </ol>
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-2 text-xs text-yellow-800 dark:text-yellow-200">
                <p className="font-semibold">{t('platforms.dingtalkBot.guide.step2SecurityTitle', 'Security Tip')}</p>
                <p>{t('platforms.dingtalkBot.guide.step2SecurityText', 'Keep AppSecret, AES Key, and Token safe; they are used for verification and encryption.')}</p>
              </div>
            </div>
          </details>

          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.dingtalkBot.guide.step3Title', '3️⃣ Publish App')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t('platforms.dingtalkBot.guide.step3Item1', 'Click \'Save\' on this platform.')}</li>
                <li>{t('platforms.dingtalkBot.guide.step3Item2', 'Go back to DingTalk, click \'Version Management & Release\' → \'Create Version\'.')}</li>
                <li>{t('platforms.dingtalkBot.guide.step3Item3', 'Submit for review; it will be ready after admin approval.')}</li>
              </ol>
              <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://open.dingtalk.com/document/orgapp/robot-overview" target="_blank" rel="noreferrer">{t('platforms.dingtalkBot.guide.docsLink', 'DingTalk Bot Dev Docs')}</a>
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
        title={t('platforms.dingtalkBot.dialog.deleteTitle', 'Confirm Delete')}
        message={t('platforms.dingtalkBot.dialog.deleteMessage', 'Are you sure you want to delete this DingTalk Bot platform? This action cannot be undone.')}
        confirmText={t('platforms.dingtalkBot.dialog.confirmDelete', 'Delete')}
        cancelText={t('platforms.dingtalkBot.dialog.cancel', 'Cancel')}
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
            showSuccess(showToast, t('platforms.dingtalkBot.messages.deleteSuccess', 'Deleted Successfully'), t('platforms.dingtalkBot.messages.deleteSuccessMessage', 'DingTalk Bot platform has been deleted'));
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

export default DingTalkBotPlatformConfig;

