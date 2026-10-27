import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Code, GitBranch, Clock, Github, Globe, ArrowUpRight, Layers, Cpu } from 'lucide-react';
import { systemApiService, type SystemInfoResponse } from '@/services/systemApi';
import { ErrorPanel } from '@/components/ui/PageKit';
import { SettingsPage, SettingsCard, SettingsLoader, InfoLine } from './SettingsKit';

const ENV_STYLES: Record<string, string> = {
  production: 'bg-acid-300 text-ink-900',
  development: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const AboutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const info = await systemApiService.getSystemInfo();
        setSystemInfo(info);
      } catch (err) {
        console.error('Failed to fetch system info:', err);
        setError(t('about.loadError', 'Failed to load system information'));
      } finally {
        setLoading(false);
      }
    };

    fetchSystemInfo();
  }, [t]);

  const links = [
    { href: 'https://github.com/tgoai/tgo', icon: Github, label: t('about.github', 'GitHub Repository'), sub: 'github.com/tgoai/tgo' },
    { href: 'https://tgo.ai', icon: Globe, label: t('about.website', 'Official Website'), sub: 'tgo.ai' },
  ];

  return (
    <SettingsPage
      title={t('common.about', 'About')}
      subtitle={t('about.subtitle', 'Build, version and runtime details for this workspace.')}
    >
      {loading && <SettingsLoader label={t('about.loading', 'Loading...')} />}

      {error && !loading && <ErrorPanel message={error} />}

      {!loading && !error && systemInfo && (
        <>
          {/* Version hero */}
          <section className="relative overflow-hidden rounded-[28px] bg-acid-300 p-7 text-ink-900 md:p-8 dark:bg-acid-400">
            <span aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/25" />
            <span aria-hidden="true" className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/15" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg">
                  <Layers className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-900/60">{t('about.version', 'Version')}</p>
                  <p className="tgo-display mt-1 text-[44px]">{systemInfo.version || 'N/A'}</p>
                </div>
              </div>
              <span className="inline-flex h-8 items-center gap-2 self-start rounded-full bg-ink-900 px-3 text-xs font-semibold text-acid-400 sm:self-auto">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {systemInfo.environment || 'unknown'}
              </span>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <SettingsCard icon={Server} title={t('about.systemInfo', 'System Information')}>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <InfoLine label={t('about.version', 'Version')}><span className="font-mono">{systemInfo.version || 'N/A'}</span></InfoLine>
                <InfoLine label={t('about.environment', 'Environment')}>
                  <span className={`tgo-chip ${ENV_STYLES[systemInfo.environment ?? ''] ?? ''}`}>{systemInfo.environment || 'unknown'}</span>
                </InfoLine>
                <InfoLine icon={Cpu} label={t('about.apiVersion', 'API Version')}><span className="font-mono">{systemInfo.api_version || 'N/A'}</span></InfoLine>
              </div>
            </SettingsCard>

            <SettingsCard icon={Code} title={t('about.technicalDetails', 'Technical Details')}>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <InfoLine label={t('about.pythonVersion', 'Python Version')}><span className="font-mono">{systemInfo.python_version || 'N/A'}</span></InfoLine>
                <InfoLine icon={Clock} label={t('about.buildTime', 'Build Time')}><span className="font-mono text-[13px]">{systemInfo.build_time || 'N/A'}</span></InfoLine>
                <InfoLine icon={GitBranch} label={t('about.gitCommit', 'Git Commit')}>
                  <span className="tgo-chip font-mono">{systemInfo.git_commit ? systemInfo.git_commit.substring(0, 8) : 'N/A'}</span>
                </InfoLine>
              </div>
            </SettingsCard>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {links.map(link => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tgo-surface group flex items-center gap-4 p-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{link.label}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{link.sub}</span>
                  </span>
                  <span className="tgo-icon-btn h-9 w-9 group-hover:rotate-45 group-hover:bg-acid-300 group-hover:text-ink-900">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </a>
              );
            })}
          </div>

          <p className="pt-2 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Pelatis Web. {t('about.copyright', 'All rights reserved.')}
          </p>
        </>
      )}
    </SettingsPage>
  );
};

export default AboutSettings;
