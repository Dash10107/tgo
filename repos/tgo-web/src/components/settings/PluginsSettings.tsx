import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import yaml from 'js-yaml';
import {
  Puzzle, Info, XCircle, Plus, Trash2, Play, Square, RotateCw, Terminal,
  Github, Download, Key, Copy, Check, Cpu, Box, Code, Settings, ArrowUpCircle,
  Loader2, Link2, FileCode2, ArrowLeft, Eye, AlertTriangle, Clock, Hash, Sparkles,
} from 'lucide-react';
import { usePluginStore } from '@/stores/pluginStore';
import { useAuthStore } from '@/stores/authStore';
import { formatRelativeTime } from '@/utils/dateUtils';
import { useToast } from '@/hooks/useToast';
import type { InstalledPluginInfo } from '@/types/plugin';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Modal, Field, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';
import { InkButton, GhostButton, SectionHeader, RefreshButton, EmptyPanel, SkeletonGrid } from '@/components/ui/PageKit';
import { SettingsPage, SettingsNote } from './SettingsKit';

/** Plugin manifest returned by the "fetch info" endpoint */
interface FetchedPluginInfo {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  source_url?: string;
  install_type?: string;
}

interface UpgradeTarget {
  plugin: InstalledPluginInfo;
  latest_config: { version: string };
}

interface StreamProgress {
  stage: string;
  message: string;
}

interface ApiLikeError {
  getUserMessage?: () => string;
  message?: string;
  response?: { data?: { error?: { message?: string }; detail?: string } };
}

const apiErrorMessage = (err: unknown): string | undefined => {
  const e = err as ApiLikeError | null;
  return e?.getUserMessage?.() || e?.response?.data?.error?.message || e?.response?.data?.detail || e?.message;
};

const hostnameOf = (url?: string): string => {
  if (!url) return '-';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const STATUS_STYLES: Record<InstalledPluginInfo['status'], { chip: string; dot: string }> = {
  running: { chip: 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300', dot: 'bg-acid-500' },
  error: { chip: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400', dot: 'bg-red-500' },
  installing: { chip: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', dot: 'bg-sky-400 animate-pulse' },
  pending: { chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-400' },
  stopped: { chip: '', dot: 'bg-gray-400' },
};

const PluginsSettings: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError, showInfo } = useToast();
  const { user } = useAuthStore();
  const {
    installedPlugins,
    isLoadingInstalled,
    fetchInstalledPlugins,
    uninstallPlugin,
    startPlugin,
    stopPlugin,
    restartPlugin,
    installPluginStream,
    fetchPluginInfo,
    checkPluginUpdate,
    upgradePluginStream,
    getPluginLogs,
    generateDevToken
  } = usePluginStore();

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installStep, setInstallStep] = useState<1 | 2>(1);
  const [pluginUrl, setPluginUrl] = useState('');
  const [fetchedPluginInfo, setFetchedPluginInfo] = useState<FetchedPluginInfo | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<StreamProgress | null>(null);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [yamlConfig, setYamlConfig] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [showManualMode, setShowManualMode] = useState(false);
  const [showLogsPluginId, setShowLogsPluginId] = useState<string | null>(null);
  const [showDetailPlugin, setShowDetailPlugin] = useState<InstalledPluginInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [processingPlugins, setProcessingPlugins] = useState<Record<string, string | null>>({});
  const [uninstallTarget, setUninstallTarget] = useState<InstalledPluginInfo | null>(null);

  const [isCheckingUpdate, setIsCheckingUpdate] = useState<Record<string, boolean>>({});
  const [showUpgradeModal, setShowUpgradeModal] = useState<UpgradeTarget | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState<StreamProgress | null>(null);

  useEffect(() => {
    fetchInstalledPlugins();
  }, [fetchInstalledPlugins]);

  // Keep the logs view live while it is open
  useEffect(() => {
    if (!showLogsPluginId) return undefined;
    const timer = window.setInterval(() => {
      getPluginLogs(showLogsPluginId).then(setLogs).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [showLogsPluginId, getPluginLogs]);

  const handlePluginAction = async (pluginId: string, action: 'start' | 'stop' | 'restart' | 'uninstall') => {
    setProcessingPlugins(prev => ({ ...prev, [pluginId]: action }));
    try {
      switch (action) {
        case 'start': await startPlugin(pluginId); break;
        case 'stop': await stopPlugin(pluginId); break;
        case 'restart': await restartPlugin(pluginId); break;
        case 'uninstall': await uninstallPlugin(pluginId); break;
      }
    } catch (error) {
      console.error(`Action ${action} failed for plugin ${pluginId}:`, error);
      showError(t('common.error', 'Error'), apiErrorMessage(error));
    } finally {
      setProcessingPlugins(prev => ({ ...prev, [pluginId]: null }));
    }
  };

  const handleCheckUpdate = async (pluginId: string) => {
    setIsCheckingUpdate(prev => ({ ...prev, [pluginId]: true }));
    try {
      const info = await checkPluginUpdate(pluginId) as { has_update?: boolean; message?: string };

      if (info.message) {
        showInfo(
          info.has_update ? t('settings.plugins.updateAvailable', 'Update Available') : t('common.notice', 'Notice'),
          info.message
        );
      } else if (!info.has_update) {
        showSuccess(t('settings.plugins.checkUpdate', 'Check Update'), t('settings.plugins.noUpdate', 'Already the latest version'));
      }

      // Refresh list to show the badge persisted in DB
      await fetchInstalledPlugins();
    } catch (error) {
      console.error(`Failed to check update for ${pluginId}:`, error);
      showError(t('settings.plugins.checkUpdateError', 'Failed to check for updates'), apiErrorMessage(error));
    } finally {
      setIsCheckingUpdate(prev => ({ ...prev, [pluginId]: false }));
    }
  };

  const handleOpenUpgrade = async (plugin: InstalledPluginInfo) => {
    setIsCheckingUpdate(prev => ({ ...prev, [plugin.plugin_id]: true }));
    try {
      const info = await checkPluginUpdate(plugin.plugin_id) as { latest_config?: UpgradeTarget['latest_config'] };
      if (info.latest_config) {
        setShowUpgradeModal({ plugin, latest_config: info.latest_config });
      }
    } catch (e) {
      console.error(e);
      showError(t('settings.plugins.checkUpdateError', 'Failed to check for updates'), apiErrorMessage(e));
    } finally {
      setIsCheckingUpdate(prev => ({ ...prev, [plugin.plugin_id]: false }));
    }
  };

  const handleUpgrade = async () => {
    if (!showUpgradeModal) return;
    const { plugin, latest_config } = showUpgradeModal;

    setIsUpgrading(true);
    setUpgradeProgress({ stage: 'preparing', message: t('settings.plugins.upgrade.preparing', 'Preparing upgrade...') });

    const fail = (error: unknown) => {
      setUpgradeProgress({ stage: 'error', message: apiErrorMessage(error) || t('settings.plugins.upgrade.error', 'Upgrade failed') });
      setIsUpgrading(false);
    };

    try {
      await upgradePluginStream(
        plugin.plugin_id,
        latest_config,
        (data) => {
          setUpgradeProgress(data);
          if (data.stage === 'complete') {
            setTimeout(() => {
              setShowUpgradeModal(null);
              setUpgradeProgress(null);
              setIsUpgrading(false);
              fetchInstalledPlugins();
            }, 1500);
          } else if (data.stage === 'error') {
            setIsUpgrading(false);
          }
        },
        fail
      );
    } catch (error) {
      fail(error);
    }
  };

  const handleFetchInfo = async () => {
    if (!pluginUrl.trim()) return;
    setIsFetchingInfo(true);
    setFetchError(null);
    try {
      const info = await fetchPluginInfo(pluginUrl) as FetchedPluginInfo;
      setFetchedPluginInfo(info);
      setInstallStep(2);
    } catch (error) {
      setFetchError(apiErrorMessage(error) || t('settings.plugins.fetch.error', 'Unable to fetch plugin information. Please check that the URL is correct.'));
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleInstall = async () => {
    let config: unknown;
    if (showManualMode) {
      if (!yamlConfig.trim()) return;
      try {
        config = yaml.load(yamlConfig);
      } catch (error) {
        setFetchError(error instanceof Error ? error.message : t('settings.plugins.install.error', 'Installation failed'));
        return;
      }
    } else {
      if (!fetchedPluginInfo) return;
      config = fetchedPluginInfo;
    }

    setIsInstalling(true);
    setInstallProgress({ stage: 'preparing', message: t('settings.plugins.install.preparing', 'Preparing installation...') });

    const fail = (error: unknown) => {
      setInstallProgress({ stage: 'error', message: apiErrorMessage(error) || t('settings.plugins.install.error', 'Installation failed') });
      setIsInstalling(false);
    };

    try {
      await installPluginStream(
        config,
        (data) => {
          setInstallProgress(data);
          if (data.stage === 'complete') {
            fetchInstalledPlugins();
            setIsInstalling(false);
          } else if (data.stage === 'error') {
            setIsInstalling(false);
          }
        },
        fail
      );
    } catch (error) {
      fail(error);
    }
  };

  const handleGenerateToken = async () => {
    if (!user?.project_id) return;
    setIsGeneratingToken(true);
    try {
      const { token } = await generateDevToken(user.project_id);
      setDevToken(token);
      setShowTokenModal(true);
    } catch (error) {
      showError(t('settings.plugins.token.error', 'Failed to generate token'), apiErrorMessage(error));
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleCopyToken = () => {
    if (!devToken) return;
    navigator.clipboard.writeText(devToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => showError(t('common.copyFailed', 'Copy failed')));
  };

  const resetInstallState = () => {
    setShowInstallModal(false);
    setInstallProgress(null);
    setYamlConfig('');
    setPluginUrl('');
    setFetchedPluginInfo(null);
    setFetchError(null);
    setShowManualMode(false);
    setInstallStep(1);
    setIsInstalling(false);
  };

  const handleShowLogs = async (pluginId: string) => {
    setShowLogsPluginId(pluginId);
    try {
      setLogs(await getPluginLogs(pluginId));
    } catch {
      setLogs([]);
    }
  };

  const runningCount = installedPlugins.filter(p => p.status === 'running').length;
  const devCount = installedPlugins.filter(p => p.is_dev_mode).length;

  /* ---------- Install modal content ---------- */

  const renderInstallProgress = (progress: StreamProgress) => {
    const isGithub = !fetchedPluginInfo || fetchedPluginInfo.install_type === 'github';
    const stageOrder = ['preparing', 'cloning', 'downloading', 'copying', 'building', 'starting', 'complete'];
    const currentIdx = stageOrder.indexOf(progress.stage);
    const steps = [
      { id: 'preparing', label: t('settings.plugins.install.stage.preparing', 'Prepare environment'), icon: Settings },
      { id: 'cloning', label: t('settings.plugins.install.stage.cloning', 'Clone code'), type: 'github', icon: Github },
      { id: 'downloading', label: t('settings.plugins.install.stage.downloading', 'Download artifact'), type: 'binary', icon: Download },
      { id: 'copying', label: t('settings.plugins.install.stage.copying', 'Deploy files'), icon: Box },
      { id: 'building', label: t('settings.plugins.install.stage.building', 'Compile and build'), type: 'github', icon: Code },
      { id: 'starting', label: t('settings.plugins.install.stage.starting', 'Start service'), icon: Play },
    ].filter(s => !(s.type === 'github' && !isGithub) && !(s.type === 'binary' && isGithub));
    const isComplete = progress.stage === 'complete';
    const isError = progress.stage === 'error';

    return (
      <div className="tgo-fade-in space-y-6 py-2">
        <div className="flex flex-col items-center text-center">
          <span className={`relative flex h-20 w-20 items-center justify-center rounded-full ${
            isComplete ? 'bg-acid-300 text-ink-900' : isError ? 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400' : 'tgo-pulse-ring bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900'
          }`}>
            {isComplete ? <Check className="h-8 w-8" strokeWidth={3} /> : isError ? <XCircle className="h-8 w-8" /> : <Loader2 className="h-8 w-8 animate-spin" />}
          </span>
          <h3 className="mt-5 text-2xl font-light tracking-tight text-gray-900 dark:text-white">
            {isComplete ? t('settings.plugins.install.success', 'Installation successful')
              : isError ? t('settings.plugins.install.error', 'Installation failed')
              : t('settings.plugins.install.processing', 'Installing plugin...')}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">{progress.message}</p>
        </div>

        <ol className="tgo-well space-y-1 p-3">
          {steps.map(step => {
            const stepIdx = stageOrder.indexOf(step.id);
            const isDone = isComplete || (currentIdx >= 0 && stepIdx < currentIdx);
            const isCurrent = progress.stage === step.id;
            const Icon = step.icon;
            return (
              <li key={step.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${isCurrent ? 'bg-white shadow-sm dark:bg-gray-800' : ''}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${
                  isDone ? 'bg-acid-300 text-ink-900' : isCurrent ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                }`}>
                  {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                </span>
                <span className={`text-sm ${isCurrent ? 'font-medium text-gray-900 dark:text-white' : isDone ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {isCurrent && <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-400" />}
              </li>
            );
          })}
        </ol>

        {isComplete && (
          <p className="text-center text-sm font-medium text-acid-700 dark:text-acid-400">
            {t('settings.plugins.install.enjoy', 'Everything is ready, start exploring!')}
          </p>
        )}
      </div>
    );
  };

  const renderInstallForm = () => (
    <>
      {fetchError && (
        <div className="tgo-fade-in flex items-start gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t('common.error', 'Error')}</p>
            <p className="mt-0.5 break-words">{fetchError}</p>
          </div>
        </div>
      )}

      {showManualMode ? (
        <div className="tgo-fade-in space-y-4">
          <SettingsNote icon={Info} tone="warning">
            <p className="font-medium">{t('settings.plugins.install.manual.title', 'Manual Install Mode')}</p>
            <p className="mt-0.5">{t('settings.plugins.install.manual.description', 'Paste the plugin description YAML file to install. Recommended only for advanced users or development and debugging.')}</p>
          </SettingsNote>
          <Field label={t('settings.plugins.install.modal.yamlLabel', 'Plugin Config (YAML)')} htmlFor="plugin-yaml">
            <textarea
              id="plugin-yaml"
              value={yamlConfig}
              onChange={(e) => setYamlConfig(e.target.value)}
              placeholder="id: com.example.plugin..."
              className="tgo-input h-64 resize-none font-mono text-[13px]"
            />
          </Field>
          <button
            type="button"
            onClick={() => { setShowManualMode(false); setFetchError(null); }}
            className="tgo-pill h-8 px-3 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('settings.plugins.install.backToUrl', 'Back to URL mode')}
          </button>
        </div>
      ) : installStep === 1 ? (
        <div className="tgo-fade-in space-y-5">
          <Field
            label={t('settings.plugins.install.url.label', 'Plugin URL')}
            htmlFor="plugin-url"
            hint={t('settings.plugins.install.url.description', 'Enter the remote URL of the plugin, the system will automatically fetch configuration and prepare for installation.')}
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="plugin-url"
                  type="text"
                  value={pluginUrl}
                  onChange={(e) => {
                    setPluginUrl(e.target.value);
                    if (fetchError) setFetchError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchInfo()}
                  placeholder="https://github.com/user/repo"
                  className="tgo-input pl-11 font-mono text-[13px]"
                  autoFocus
                />
              </div>
              <PrimaryButton onClick={handleFetchInfo} loading={isFetchingInfo} disabled={!pluginUrl.trim()} icon={<Download className="h-4 w-4" />}>
                {t('settings.plugins.install.fetch', 'Fetch Info')}
              </PrimaryButton>
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Github, name: 'GitHub', desc: t('settings.plugins.install.url.github.desc', 'Supports repo URL and branch path') },
              { icon: Puzzle, name: 'Gitee', desc: t('settings.plugins.install.url.gitee.desc', 'Domestic acceleration, supports Gitee') },
              { icon: FileCode2, name: t('settings.plugins.install.url.customName', 'Custom'), desc: t('settings.plugins.install.url.custom.desc', 'Supports direct YAML or directory URL') },
            ].map(source => {
              const Icon = source.icon;
              return (
                <div key={source.name} className="tgo-well p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">{source.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{source.desc}</p>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { setShowManualMode(true); setFetchError(null); }}
            className="text-xs font-medium text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline dark:hover:text-white"
          >
            {t('settings.plugins.install.useManual', 'Use manual YAML paste mode')}
          </button>
        </div>
      ) : fetchedPluginInfo && (
        <div className="tgo-fade-in space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-acid-700 dark:text-acid-400">
            <Check className="h-4 w-4" />
            {t('settings.plugins.install.preview.success', 'Plugin configuration parsed successfully')}
          </div>

          <div className="relative overflow-hidden rounded-[24px] bg-ink-900 p-6 text-white dark:bg-gray-800">
            <span aria-hidden="true" className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-acid-400/20 blur-xl" />
            <div className="relative flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-acid-400 text-ink-900">
                <Puzzle className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-xl font-medium tracking-tight">{fetchedPluginInfo.name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-xs text-white/60">{fetchedPluginInfo.id}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">v{fetchedPluginInfo.version}</span>
                </div>
              </div>
            </div>
            {fetchedPluginInfo.description && (
              <p className="relative mt-4 line-clamp-3 text-sm leading-relaxed text-white/70">{fetchedPluginInfo.description}</p>
            )}
            <div className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/40">{t('settings.plugins.author', 'Author')}</p>
                <p className="mt-0.5 truncate">{fetchedPluginInfo.author || '-'}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/40">{t('settings.plugins.install.source', 'Source')}</p>
                <p className="mt-0.5 truncate" title={fetchedPluginInfo.source_url}>{hostnameOf(fetchedPluginInfo.source_url)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const installFooter = installProgress ? (
    installProgress.stage === 'error' ? (
      <>
        <SecondaryButton onClick={resetInstallState}>{t('common.close', 'Close')}</SecondaryButton>
        <PrimaryButton onClick={() => setInstallProgress(null)} icon={<ArrowLeft className="h-4 w-4" />}>{t('common.back', 'Back')}</PrimaryButton>
      </>
    ) : installProgress.stage === 'complete' ? (
      <PrimaryButton onClick={resetInstallState} icon={<Check className="h-4 w-4" />}>{t('common.complete', 'Complete')}</PrimaryButton>
    ) : null
  ) : showManualMode ? (
    <>
      <SecondaryButton onClick={() => setShowManualMode(false)}>{t('common.cancel', 'Cancel')}</SecondaryButton>
      <PrimaryButton onClick={handleInstall} loading={isInstalling} disabled={!yamlConfig.trim()} icon={<Plus className="h-4 w-4" />}>
        {isInstalling ? t('common.installing', 'Installing...') : t('common.install', 'Install')}
      </PrimaryButton>
    </>
  ) : installStep === 1 ? (
    <SecondaryButton onClick={resetInstallState}>{t('common.close', 'Close')}</SecondaryButton>
  ) : (
    <>
      <SecondaryButton onClick={() => { setInstallStep(1); setFetchError(null); }} disabled={isInstalling}>
        {t('settings.plugins.install.back', 'Back')}
      </SecondaryButton>
      <PrimaryButton onClick={handleInstall} loading={isInstalling} icon={<Check className="h-4 w-4" />}>
        {isInstalling ? t('common.installing', 'Installing...') : t('settings.plugins.install.confirm', 'Confirm and Install')}
      </PrimaryButton>
    </>
  );

  /* ---------- Page ---------- */

  return (
    <SettingsPage
      wide
      title={t('settings.plugins.title', 'Plugins')}
      subtitle={t('settings.plugins.subtitle', 'View and manage plugins connected to Pelatis')}
      actions={
        <>
          <GhostButton onClick={handleGenerateToken} disabled={isGeneratingToken}>
            {isGeneratingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            {t('settings.plugins.token.generate', 'Debug Token')}
          </GhostButton>
          <InkButton onClick={() => setShowInstallModal(true)} icon={<Plus className="h-4 w-4" />}>
            {t('settings.plugins.install.button', 'Install Plugin')}
          </InkButton>
        </>
      }
    >
      {/* Figures */}
      <div className="flex flex-wrap items-end gap-8 md:gap-12">
        {[
          { key: 'installed', value: installedPlugins.length, label: t('settings.plugins.statInstalled', 'installed'), badge: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200', badgeText: t('common.all', 'All') },
          { key: 'running', value: runningCount, label: t('settings.plugins.status.running', 'running').toLowerCase(), badge: 'bg-acid-300 text-ink-900' },
          { key: 'debug', value: devCount, label: t('settings.plugins.debug.badge', 'debug').toLowerCase(), badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
        ].map(stat => (
          <div key={stat.key} className="flex items-end gap-2">
            <span key={stat.value} className="tgo-pop tgo-display text-[44px] tabular-nums text-gray-900 dark:text-white">{stat.value}</span>
            <span className="mb-1 flex flex-col items-start gap-1">
              <span className={`rounded-full px-1.5 text-[10px] font-semibold leading-4 ${stat.badge}`}>
                {stat.badgeText ?? `${installedPlugins.length > 0 ? Math.round((stat.value / installedPlugins.length) * 100) : 0}%`}
              </span>
              <span className="text-sm text-gray-400 dark:text-gray-500">{stat.label}</span>
            </span>
          </div>
        ))}
      </div>

      <section className="space-y-5">
        <SectionHeader title={t('settings.plugins.listTitle', 'Installed plugins')} count={installedPlugins.length} countLabel={t('settings.plugins.countLabel', 'plugins')}>
          <RefreshButton onClick={() => fetchInstalledPlugins()} spinning={isLoadingInstalled} disabled={isLoadingInstalled} />
        </SectionHeader>

        {isLoadingInstalled && installedPlugins.length === 0 ? (
          <SkeletonGrid count={2} className="grid grid-cols-1 gap-5 xl:grid-cols-2" itemClassName="h-56" />
        ) : installedPlugins.length === 0 ? (
          <EmptyPanel
            icon={Puzzle}
            title={t('settings.plugins.installed.empty.title', 'No plugins yet')}
            description={t('settings.plugins.installed.empty.description', 'You can install from GitHub source, via binary files, or connect local plugins using debug tokens.')}
            action={
              <InkButton onClick={() => setShowInstallModal(true)} icon={<Plus className="h-4 w-4" />}>
                {t('settings.plugins.install.now', 'Install Now')}
              </InkButton>
            }
          />
        ) : (
          <div className="tgo-stagger grid grid-cols-1 gap-5 xl:grid-cols-2">
            {installedPlugins.map(plugin => {
              const processing = processingPlugins[plugin.plugin_id];
              const status = STATUS_STYLES[plugin.status] ?? STATUS_STYLES.stopped;
              const SourceIcon = plugin.is_dev_mode ? Terminal : plugin.install_type === 'github' ? Github : Download;
              const hasUpdate = Boolean(plugin.latest_version && plugin.latest_version !== plugin.version);
              const busy = !!processing;

              return (
                <article key={plugin.plugin_id} className="tgo-surface flex flex-col p-6">
                  <div className="flex items-start gap-4">
                    <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${plugin.is_dev_mode ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900'}`}>
                      <SourceIcon className="h-5 w-5" />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${status.dot}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100">{plugin.name}</h3>
                        <span className="tgo-chip h-5 px-2 font-mono text-[10px]">v{plugin.version}</span>
                        {plugin.is_dev_mode && (
                          <span className="tgo-chip h-5 bg-amber-100 px-2 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            {t('settings.plugins.debug.badge', 'Debug')}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-gray-400">{plugin.plugin_id}</p>
                    </div>
                    <span className={`tgo-chip shrink-0 ${status.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {plugin.status === 'running' && plugin.is_dev_mode
                        ? t('settings.plugins.status.connected', 'Connected')
                        : t(`settings.plugins.status.${plugin.status}`, plugin.status)}
                    </span>
                  </div>

                  {plugin.description && (
                    <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{plugin.description}</p>
                  )}

                  {hasUpdate && (
                    <button
                      onClick={() => handleOpenUpgrade(plugin)}
                      className="mt-4 flex items-center gap-3 rounded-2xl bg-acid-50 px-4 py-3 text-left text-sm shadow-[inset_0_0_0_1px_rgb(182_219_52/0.45)] transition-colors hover:bg-acid-100 dark:bg-acid-400/10 dark:shadow-[inset_0_0_0_1px_rgb(205_238_85/0.2)]"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-acid-300 text-ink-900">
                        {isCheckingUpdate[plugin.plugin_id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      </span>
                      <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">
                        {t('settings.plugins.updateAvailable', 'Update Available')} · v{plugin.latest_version}
                      </span>
                      <ArrowUpCircle className="h-4 w-4 text-acid-700 dark:text-acid-400" />
                    </button>
                  )}

                  {plugin.last_error && plugin.status === 'error' && (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 dark:bg-red-900/15">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <pre className="custom-scrollbar max-h-24 flex-1 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-red-700 dark:text-red-300">{plugin.last_error}</pre>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="tgo-chip">
                      <Clock className="h-3 w-3" />
                      {plugin.is_dev_mode ? t('settings.plugins.connectedAt', 'Connected At') : t('settings.plugins.installedAt', 'Installed At')} · {formatRelativeTime(plugin.installed_at)}
                    </span>
                    {plugin.pid && <span className="tgo-chip font-mono"><Hash className="h-3 w-3" />PID {plugin.pid}</span>}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                    <button onClick={() => setShowDetailPlugin(plugin)} className="tgo-pill h-10">
                      <Eye className="h-4 w-4" />
                      {t('settings.plugins.actions.detail', 'View Details')}
                    </button>

                    {plugin.is_dev_mode ? (
                      <span className="ml-auto text-xs italic text-gray-400">
                        {t('settings.plugins.debug.autoManaged', 'Debug Mode - Auto Managed')}
                      </span>
                    ) : (
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          onClick={() => handleCheckUpdate(plugin.plugin_id)}
                          disabled={isCheckingUpdate[plugin.plugin_id]}
                          className="tgo-icon-btn h-10 w-10"
                          title={t('settings.plugins.actions.checkUpdate', 'Check for updates')}
                          aria-label={t('settings.plugins.actions.checkUpdate', 'Check for updates')}
                        >
                          {isCheckingUpdate[plugin.plugin_id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleShowLogs(plugin.plugin_id)}
                          className="tgo-icon-btn h-10 w-10"
                          title={t('settings.plugins.actions.logs', 'View logs')}
                          aria-label={t('settings.plugins.actions.logs', 'View logs')}
                        >
                          <Terminal className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePluginAction(plugin.plugin_id, 'restart')}
                          disabled={plugin.status === 'installing' || busy}
                          className="tgo-icon-btn h-10 w-10"
                          title={t('settings.plugins.actions.restart', 'Restart')}
                          aria-label={t('settings.plugins.actions.restart', 'Restart')}
                        >
                          <RotateCw className={`h-4 w-4 ${processing === 'restart' ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => setUninstallTarget(plugin)}
                          disabled={busy}
                          className="tgo-icon-btn h-10 w-10 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400"
                          title={t('settings.plugins.actions.uninstall', 'Uninstall')}
                          aria-label={t('settings.plugins.actions.uninstall', 'Uninstall')}
                        >
                          {processing === 'uninstall' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                        {plugin.status === 'running' ? (
                          <button
                            onClick={() => handlePluginAction(plugin.plugin_id, 'stop')}
                            disabled={busy}
                            className="flex h-10 items-center gap-2 rounded-full bg-ink-900 px-4 text-sm font-medium text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-60 dark:bg-acid-400 dark:text-ink-900"
                          >
                            {processing === 'stop' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5 fill-current" />}
                            {t('settings.plugins.actions.stop', 'Stop')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePluginAction(plugin.plugin_id, 'start')}
                            disabled={plugin.status === 'installing' || busy}
                            className="flex h-10 items-center gap-2 rounded-full bg-acid-300 px-4 text-sm font-medium text-ink-900 transition-transform duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-60 dark:bg-acid-400"
                          >
                            {processing === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                            {t('settings.plugins.actions.start', 'Start')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <SettingsNote icon={Terminal}>
        <p className="font-medium text-gray-900 dark:text-gray-100">{t('settings.plugins.debug.title', 'Debug Hint')}</p>
        <p className="mt-0.5">{t('settings.plugins.debug.description', 'In development mode, you can connect local plugins via port 8005 (TCP) or /var/run/tgo/tgo.sock (Unix Socket).')}</p>
      </SettingsNote>

      {/* Install */}
      <Modal
        isOpen={showInstallModal}
        onClose={resetInstallState}
        preventClose={isInstalling}
        size="lg"
        icon={Puzzle}
        title={t('settings.plugins.install.modal.title', 'Install New Plugin')}
        subtitle={installProgress ? undefined : t('settings.plugins.install.url.title', 'Install via URL')}
        footer={installFooter}
      >
        {installProgress ? renderInstallProgress(installProgress) : renderInstallForm()}
      </Modal>

      {/* Debug token */}
      <Modal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        size="lg"
        icon={Key}
        title={t('settings.plugins.token.modal.title', 'Project Debug Token')}
        footer={<PrimaryButton onClick={() => setShowTokenModal(false)}>{t('common.close', 'Close')}</PrimaryButton>}
      >
        <SettingsNote icon={Info} tone="warning">
          {t('settings.plugins.token.modal.warning', 'Token is valid for 24 hours. Local debug plugins will be automatically associated with the current project after connecting with this token.')}
        </SettingsNote>

        <Field label={t('settings.plugins.token.modal.tokenLabel', 'Your Debug Token')}>
          <div className="flex items-stretch gap-2">
            <div className="tgo-input flex-1 break-all font-mono text-xs text-gray-600 dark:text-gray-300">{devToken}</div>
            <button
              onClick={handleCopyToken}
              className={`flex w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${copied ? 'bg-acid-300 text-ink-900' : 'bg-ink-900 text-white hover:bg-ink-700 dark:bg-acid-400 dark:text-ink-900'}`}
              title={t('common.copy', 'Copy')}
              aria-label={t('common.copy', 'Copy')}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="space-y-3">
          <p className="tgo-eyebrow">{t('settings.plugins.token.modal.usage', 'Usage')}</p>
          {[
            { label: t('settings.plugins.token.modal.goSDK', 'Go SDK:'), code: `tgo.Run(&MyPlugin{},\n    tgo.WithTCPAddr("localhost:8005"),\n    tgo.WithDevToken("${devToken?.substring(0, 8)}..."))` },
            { label: t('settings.plugins.token.modal.pythonSDK', 'Python SDK:'), code: `plugin = MyPlugin(\n    tcp_addr="localhost:8005",\n    dev_token="${devToken?.substring(0, 8)}...")\nplugin.run()` },
          ].map(snippet => (
            <div key={snippet.label} className="overflow-hidden rounded-2xl bg-ink-900">
              <p className="border-b border-white/10 px-4 py-2 text-[11px] font-medium text-gray-400">{snippet.label}</p>
              <pre className="overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-acid-300">{snippet.code}</pre>
            </div>
          ))}
        </div>
      </Modal>

      {/* Logs */}
      <Modal
        isOpen={!!showLogsPluginId}
        onClose={() => setShowLogsPluginId(null)}
        size="xl"
        icon={Terminal}
        title={t('settings.plugins.logs.title', 'Plugin Logs')}
        subtitle={<span className="font-mono text-xs">{showLogsPluginId}</span>}
        footer={
          <>
            <span className="text-xs text-gray-400 sm:mr-auto">
              {t('settings.plugins.logs.lines', '{{count}} lines', { count: logs.length })} · {t('settings.plugins.logs.autoReload', 'Auto-refreshes every 5s')}
            </span>
            <SecondaryButton onClick={() => showLogsPluginId && handleShowLogs(showLogsPluginId)}>
              <RotateCw className="h-4 w-4" />
              {t('common.refresh', 'Refresh')}
            </SecondaryButton>
          </>
        }
      >
        <div className="custom-scrollbar h-[50vh] overflow-auto rounded-2xl bg-ink-950 p-4 font-mono text-xs text-gray-300">
          {logs.length > 0 ? (
            <div className="space-y-0.5">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3 rounded px-2 py-0.5 transition-colors hover:bg-white/5">
                  <span className="w-8 shrink-0 select-none text-right text-gray-600">{i + 1}</span>
                  <span className="whitespace-pre-wrap break-all">{log}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center italic text-gray-600">
              {t('settings.plugins.logs.empty', 'No logs output yet')}
            </div>
          )}
        </div>
      </Modal>

      {/* Details */}
      <Modal
        isOpen={!!showDetailPlugin}
        onClose={() => setShowDetailPlugin(null)}
        size="xl"
        icon={showDetailPlugin?.is_dev_mode ? Terminal : Puzzle}
        title={
          <span className="flex items-center gap-2">
            {showDetailPlugin?.name}
            <span className="tgo-chip font-mono">v{showDetailPlugin?.version}</span>
          </span>
        }
        subtitle={<span className="font-mono text-xs">{showDetailPlugin?.plugin_id}</span>}
        bodyClassName="space-y-6"
        footer={<SecondaryButton onClick={() => setShowDetailPlugin(null)}>{t('common.close', 'Close')}</SecondaryButton>}
      >
        {showDetailPlugin && (
          <>
            <section className="space-y-3">
              <h3 className="tgo-eyebrow flex items-center gap-1.5"><Info className="h-3.5 w-3.5" />{t('settings.plugins.detail.basicInfo', 'Basic Information')}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: t('settings.plugins.author', 'Author'), value: showDetailPlugin.author || '-' },
                  { label: t('settings.plugins.status.label', 'Current Status'), value: t(`settings.plugins.status.${showDetailPlugin.status}`, showDetailPlugin.status) },
                  { label: t('settings.plugins.installType', 'Install Type'), value: showDetailPlugin.install_type },
                  { label: t('settings.plugins.installedAt', 'Installed At'), value: formatRelativeTime(showDetailPlugin.installed_at) },
                ].map(item => (
                  <div key={item.label} className="tgo-well px-4 py-3">
                    <p className="text-[11px] text-gray-400">{item.label}</p>
                    <p className="mt-0.5 truncate text-sm font-medium capitalize text-gray-900 dark:text-gray-100">{item.value}</p>
                  </div>
                ))}
              </div>
              {showDetailPlugin.description && (
                <p className="rounded-2xl bg-acid-50 px-4 py-3 text-sm leading-relaxed text-gray-700 dark:bg-acid-400/5 dark:text-gray-300">
                  {showDetailPlugin.description}
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="tgo-eyebrow flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" />{t('settings.plugins.capabilities', 'Capabilities')}</h3>
              {showDetailPlugin.capabilities && showDetailPlugin.capabilities.length > 0 ? (
                <div className="space-y-3">
                  {showDetailPlugin.capabilities.map((cap, idx) => (
                    <div key={idx} className="rounded-3xl bg-white p-5 shadow-[inset_0_0_0_1px_var(--color-gray-200)] dark:bg-gray-800/60 dark:shadow-[inset_0_0_0_1px_var(--color-gray-700)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            <Box className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{cap.title}</span>
                          <span className="tgo-chip h-5 bg-acid-200 px-2 text-[10px] font-semibold uppercase text-ink-900 dark:bg-acid-400/20 dark:text-acid-300">{cap.type}</span>
                        </div>
                        <span className="text-xs text-gray-400">{t('settings.plugins.detail.priority', 'Priority')}: {cap.priority}</span>
                      </div>

                      {cap.type === 'tools' && cap.tools && (
                        <div className="mt-4 space-y-4 border-l-2 border-gray-100 pl-4 dark:border-gray-700">
                          <p className="tgo-eyebrow">{t('settings.plugins.detail.tools', 'Tools')} ({cap.tools.length})</p>
                          {cap.tools.map((tool, tidx) => (
                            <div key={tidx} className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">{tool.name}</span>
                                <span className="text-xs text-gray-500">{tool.title}</span>
                              </div>
                              {tool.description && <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{tool.description}</p>}
                              {tool.parameters && tool.parameters.length > 0 && (
                                <div className="overflow-x-auto rounded-2xl shadow-[inset_0_0_0_1px_var(--color-gray-100)] dark:shadow-[inset_0_0_0_1px_var(--color-gray-700)]">
                                  <table className="w-full text-left text-xs">
                                    <thead className="text-gray-400">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">{t('settings.plugins.detail.parameter', 'Parameter')}</th>
                                        <th className="px-3 py-2 font-medium">{t('settings.plugins.detail.type', 'Type')}</th>
                                        <th className="px-3 py-2 font-medium">{t('settings.plugins.detail.required', 'Required')}</th>
                                        <th className="px-3 py-2 font-medium">{t('settings.plugins.details.description', 'Description')}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                      {tool.parameters.map((param, pidx) => (
                                        <tr key={pidx}>
                                          <td className="px-3 py-2 font-mono text-gray-900 dark:text-acid-300">{param.name}</td>
                                          <td className="px-3 py-2 font-mono text-gray-500">{param.type}</td>
                                          <td className="px-3 py-2">
                                            {param.required
                                              ? <span className="tgo-chip h-5 bg-ink-900 px-2 text-[10px] text-white dark:bg-acid-400 dark:text-ink-900">{t('common.yes', 'Yes')}</span>
                                              : <span className="text-gray-400">{t('common.no', 'No')}</span>}
                                          </td>
                                          <td className="px-3 py-2 text-gray-500">{param.description || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tgo-well p-8 text-center text-sm text-gray-400">
                  {t('settings.plugins.detail.noCapabilities', 'This plugin does not declare any special capabilities')}
                </div>
              )}
            </section>
          </>
        )}
      </Modal>

      {/* Upgrade */}
      <Modal
        isOpen={!!showUpgradeModal}
        onClose={() => setShowUpgradeModal(null)}
        preventClose={isUpgrading}
        size="sm"
        icon={ArrowUpCircle}
        tone="acid"
        title={t('settings.plugins.upgrade.title', 'Plugin Upgrade')}
        subtitle={showUpgradeModal?.plugin.name}
        footer={
          !isUpgrading && (
            <>
              <SecondaryButton onClick={() => setShowUpgradeModal(null)}>{t('common.cancel', 'Cancel')}</SecondaryButton>
              <PrimaryButton onClick={handleUpgrade} icon={<ArrowUpCircle className="h-4 w-4" />}>{t('settings.plugins.upgrade.confirm', 'Upgrade Now')}</PrimaryButton>
            </>
          )
        }
      >
        {showUpgradeModal && (
          <>
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="text-center">
                <p className="text-[11px] text-gray-400">{t('settings.plugins.upgrade.currentVersion', 'Current Version')}</p>
                <p className="tgo-display mt-1 text-[28px] text-gray-500">v{showUpgradeModal.plugin.version}</p>
              </div>
              <ArrowLeft className="h-5 w-5 rotate-180 text-gray-300" />
              <div className="text-center">
                <p className="text-[11px] text-gray-400">{t('settings.plugins.upgrade.latestVersion', 'Latest Version')}</p>
                <p className="tgo-display mt-1 text-[28px] text-gray-900 dark:text-white">v{showUpgradeModal.latest_config.version}</p>
              </div>
            </div>

            {upgradeProgress && (
              <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${
                upgradeProgress.stage === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                  : upgradeProgress.stage === 'complete' ? 'bg-acid-50 text-acid-800 dark:bg-acid-400/10 dark:text-acid-300'
                  : 'tgo-well text-gray-700 dark:text-gray-200'
              }`}>
                {upgradeProgress.stage === 'error' ? <XCircle className="h-4 w-4 shrink-0" />
                  : upgradeProgress.stage === 'complete' ? <Check className="h-4 w-4 shrink-0" />
                  : <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                <span className="font-medium">{upgradeProgress.message}</span>
              </div>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!uninstallTarget}
        title={t('settings.plugins.actions.uninstall', 'Uninstall')}
        message={t('settings.plugins.actions.uninstallConfirm', 'Are you sure you want to uninstall this plugin? This action cannot be undone.')}
        confirmText={t('settings.plugins.actions.uninstall', 'Uninstall')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        onConfirm={() => {
          if (uninstallTarget) handlePluginAction(uninstallTarget.plugin_id, 'uninstall');
          setUninstallTarget(null);
        }}
        onCancel={() => setUninstallTarget(null)}
      />
    </SettingsPage>
  );
};

export default PluginsSettings;
