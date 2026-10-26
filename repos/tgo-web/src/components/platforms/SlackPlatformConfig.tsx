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
    platform: Platform;
}

const SlackPlatformConfig: React.FC<Props> = ({ platform }) => {
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

    // Local form state
    const [formValues, setFormValues] = useState(() => ({
        botToken: (platform.config as any)?.bot_token ?? '',
        appToken: (platform.config as any)?.app_token ?? '',
        signingSecret: (platform.config as any)?.signing_secret ?? '',
    }));

    useEffect(() => {
        setFormValues({
            botToken: (platform.config as any)?.bot_token ?? '',
            appToken: (platform.config as any)?.app_token ?? '',
            signingSecret: (platform.config as any)?.signing_secret ?? '',
        });
    }, [platform]);

    const handleChange = (patch: Partial<typeof formValues>) => {
        setFormValues(v => ({ ...v, ...patch }));
        const toSave: Partial<PlatformConfig> = {
            ...(patch.botToken !== undefined ? { botToken: patch.botToken } : {}),
            ...(patch.appToken !== undefined ? { appToken: patch.appToken } : {}),
            ...(patch.signingSecret !== undefined ? { signingSecret: patch.signingSecret } : {}),
        };
        updatePlatformConfig(platform.id, toSave);
    };

    const handleSave = async () => {
        try {
            const updates: Partial<Platform> = {};
            if (hasConfigChanges) {
                updates.config = {
                    bot_token: (formValues.botToken || '').trim(),
                    app_token: (formValues.appToken || '').trim(),
                    signing_secret: (formValues.signingSecret || '').trim(),
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
            showSuccess(showToast, t('platforms.slack.messages.saveSuccess', 'Saved successfully'), t('platforms.slack.messages.saveSuccessMessage', 'Slack Bot configuration updated'));
        } catch (e) {
            showApiError(showToast, e);
        }
    };

    const displayName = platform.display_name || platform.name;

    return (
        <main className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('platforms.slack.header.title', { name: displayName, defaultValue: '{{name}} Configuration' })}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('platforms.slack.header.subtitle', 'Configure Slack Bot credentials and security settings.')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        disabled={isUpdating || isDeleting}
                        onClick={() => setConfirmOpen(true)}
                        className={`px-3 py-1.5 text-sm rounded-md ${isDeleting ? 'bg-red-400 text-white' : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600'}`}
                    >
                        {isDeleting ? t('platforms.slack.buttons.deleting', 'Deleting...') : t('platforms.slack.buttons.delete', 'Delete')}
                    </button>
                    <button
                        disabled={isUpdating || isDeleting || isToggling}
                        onClick={async () => {
                            if (isToggling) return;
                            setIsToggling(true);
                            try {
                                if (isEnabled) {
                                    await disablePlatform(platform.id);
                                    showSuccess(showToast, t('platforms.slack.messages.disabled', 'Platform disabled'));
                                } else {
                                    await enablePlatform(platform.id);
                                    showSuccess(showToast, t('platforms.slack.messages.enabled', 'Platform enabled'));
                                }
                            } catch (e) {
                                showApiError(showToast, e);
                            } finally {
                                setIsToggling(false);
                            }
                        }}
                        className={`px-3 py-1.5 text-sm rounded-md text-white ${isEnabled ? 'bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'} ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isToggling ? (isEnabled ? t('platforms.slack.buttons.disabling', 'Disabling...') : t('platforms.slack.buttons.enabling', 'Enabling...')) : (isEnabled ? t('platforms.slack.buttons.disable', 'Disable') : t('platforms.slack.buttons.enable', 'Enable'))}
                    </button>

                    <button
                        disabled={!canSave || isUpdating}
                        onClick={handleSave}
                        className={`px-3 py-1.5 text-sm rounded-md ${canSave ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                    >
                        {isUpdating ? t('platforms.slack.buttons.saving', 'Saving...') : t('platforms.slack.buttons.save', 'Save')}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 p-6">
                {/* Left: form */}
                <section className="lg:w-2/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 space-y-4 overflow-y-auto min-h-0 auto-hide-scrollbar">
                    {/* Platform name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.slack.form.name', 'Platform Name')}</label>
                        <input
                            type="text"
                            value={platformName}
                            onChange={(e) => setPlatformName(e.target.value)}
                            placeholder={t('platforms.slack.form.namePlaceholder', 'Enter platform name')}
                            className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                        />
                    </div>

                    {/* Bot Token */}
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.slack.form.botToken', 'Bot Token')}</label>
                        <input
                            type="password"
                            value={formValues.botToken}
                            onChange={(e) => handleChange({ botToken: e.target.value })}
                            placeholder={t('platforms.slack.form.botTokenPlaceholder', 'xoxb-...')}
                            className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.slack.form.botTokenHint', 'Get the Bot User OAuth Token from the \'OAuth & Permissions\' page of your Slack App.')}</p>
                    </div>

                    {/* App Token */}
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.slack.form.appToken', 'App Token (Socket Mode)')}</label>
                        <input
                            type="password"
                            value={formValues.appToken}
                            onChange={(e) => handleChange({ appToken: e.target.value })}
                            placeholder={t('platforms.slack.form.appTokenPlaceholder', 'xapp-...')}
                            className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.slack.form.appTokenHint', 'Generate in \'Basic Information\' -> \'App-Level Tokens\' (requires connections:write scope).')}</p>
                    </div>

                    {/* Signing Secret */}
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.slack.form.signingSecret', 'Signing Secret (Optional)')}</label>
                        <input
                            type="password"
                            value={formValues.signingSecret}
                            onChange={(e) => handleChange({ signingSecret: e.target.value })}
                            placeholder={t('platforms.slack.form.signingSecretPlaceholder', 'Secret for verifying request origin')}
                            className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.slack.form.signingSecretHint', 'Get from \'Basic Information\' -> \'App Credentials\' to enhance security.')}</p>
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
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('platforms.slack.guide.title', 'Slack Bot Configuration Guide')}</h3>

                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm rounded-md p-3">
                        <p className="font-medium">{t('platforms.slack.guide.overview', 'Quick Overview')}</p>
                        <p className="mt-1">{t('platforms.slack.guide.overviewText', 'Complete these steps: ① Create Slack App -> ② Enable Socket Mode & get App Token -> ③ Configure Bot permissions & event subscriptions -> ④ Install to workspace & get Bot Token.')}</p>
                    </div>

                    <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50" open>
                        <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.slack.guide.step1Title', '1️⃣ Create Slack App')}</summary>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                            <ol className="list-decimal pl-5 space-y-1">
                                <li dangerouslySetInnerHTML={{ __html: t('platforms.slack.guide.step1Item1', 'Visit <a class="text-blue-600 hover:underline" href="https://api.slack.com/apps" target="_blank" rel="noreferrer">api.slack.com/apps</a> and click \'Create New App\'.') }} />
                                <li>{t('platforms.slack.guide.step1Item2', 'Select \'From scratch\', enter App name and select target workspace.')}</li>
                                <li>{t('platforms.slack.guide.step1Item3', 'Set display name in \'App Home\' and ensure \'Messages Tab\' is enabled.')}</li>
                            </ol>
                        </div>
                    </details>

                    <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
                        <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.slack.guide.step2Title', '2️⃣ Enable Socket Mode')}</summary>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>{t('platforms.slack.guide.step2Item1', 'Click \'Socket Mode\' in the left menu and turn it on.')}</li>
                                <li dangerouslySetInnerHTML={{ __html: t('platforms.slack.guide.step2Item2', 'Generate an App-Level Token as prompted, ensuring it includes the <code>connections:write</code> scope.') }} />
                                <li dangerouslySetInnerHTML={{ __html: t('platforms.slack.guide.step2Item3', 'Copy the generated <code>xapp-...</code> Token and paste it into the \'App Token\' field on the left.') }} />
                            </ol>
                        </div>
                    </details>

                    <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
                        <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.slack.guide.step3Title', '3️⃣ Configure Permissions & Events')}</summary>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>{t('platforms.slack.guide.step3Item1', 'Add required scopes (e.g., chat:write, im:history) to \'Bot Token Scopes\' in \'OAuth & Permissions\'.')}</li>
                                <li dangerouslySetInnerHTML={{ __html: t('platforms.slack.guide.step3Item2', 'Enable events in \'Event Subscriptions\' and add <code>message.im</code> and <code>app_mention</code>.') }} />
                            </ol>
                        </div>
                    </details>

                    <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
                        <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.slack.guide.step4Title', '4️⃣ Installation & Integration')}</summary>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>{t('platforms.slack.guide.step4Item1', 'Click \'Install to Workspace\' and complete authorization.')}</li>
                                <li>{t('platforms.slack.guide.step4Item2', 'Copy the \'Bot User OAuth Token\' (xoxb-...) and paste it into the \'Bot Token\' field on the left.')}</li>
                                <li>{t('platforms.slack.guide.step4Item3', 'Once saved, your AI assistant will be ready to respond on Slack.')}</li>
                            </ol>
                            <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://api.slack.com/docs" target="_blank" rel="noreferrer">{t('platforms.slack.guide.docsLink', 'Official Slack API Documentation')}</a>
                        </div>
                    </details>
                </section>
            </div>

            <style>{`
                .auto-hide-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.3) transparent; }
                .auto-hide-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
                .auto-hide-scrollbar::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 4px; }
                .auto-hide-scrollbar:hover::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.35); }
            `}</style>
            <ConfirmDialog
                isOpen={confirmOpen}
                title={t('platforms.slack.dialog.deleteTitle', 'Confirm Delete')}
                message={t('platforms.slack.dialog.deleteMessage', 'Are you sure you want to delete this Slack Bot platform? This action cannot be undone.')}
                confirmText={t('platforms.slack.dialog.confirmDelete', 'Delete')}
                cancelText={t('platforms.slack.dialog.cancel', 'Cancel')}
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
                        showSuccess(showToast, t('platforms.slack.messages.deleteSuccess', 'Deleted successfully'), t('platforms.slack.messages.deleteSuccessMessage', 'Slack Bot platform deleted'));
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

export default SlackPlatformConfig;
