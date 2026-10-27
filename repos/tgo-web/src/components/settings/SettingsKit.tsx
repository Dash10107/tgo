/**
 * Layout pieces shared by the settings screens, in the workflow page's
 * language: a light display heading, white rounded cards and quiet rows.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, type LucideIcon } from 'lucide-react';

interface SettingsPageProps {
  title: string;
  subtitle?: string;
  /** Primary actions beside the heading */
  actions?: React.ReactNode;
  /** Wider canvas for list-heavy pages */
  wide?: boolean;
  children: React.ReactNode;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ title, subtitle, actions, wide, children }) => {
  const { t } = useTranslation();
  return (
    <div className={`mx-auto w-full space-y-8 px-6 py-8 md:px-10 md:py-10 ${wide ? 'max-w-[1400px]' : 'max-w-5xl'}`}>
      <header className="tgo-fade-up flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="tgo-eyebrow mb-3">{t('settings.title', 'Settings')}</p>
          <h1 className="tgo-display text-[40px] uppercase text-gray-900 md:text-[48px] dark:text-white">{title}</h1>
          {subtitle && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </header>
      <div className="tgo-stagger space-y-6">{children}</div>
    </div>
  );
};

interface SettingsCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Tailwind classes for the icon badge */
  iconTone?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Remove body padding (for edge-to-edge lists) */
  flush?: boolean;
  children?: React.ReactNode;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  icon: Icon,
  iconTone = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  actions,
  className = '',
  flush,
  children,
}) => (
  <section className={`tgo-surface ${flush ? 'overflow-hidden' : 'p-6 md:p-7'} ${className}`}>
    {(title || actions) && (
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${flush ? 'px-6 pt-6 md:px-7 md:pt-7' : ''}`}>
        <div className="flex min-w-0 items-start gap-4">
          {Icon && (
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <div className="min-w-0">
            {title && <h2 className="text-lg font-medium tracking-tight text-gray-900 dark:text-white">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children && <div className={title || actions ? (flush ? 'mt-5' : 'mt-6') : ''}>{children}</div>}
  </section>
);

interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  iconTone?: string;
  /** Control rendered on the right */
  children?: React.ReactNode;
  disabled?: boolean;
}

/** Label/description on the left, control on the right; stack inside `divide-y` */
export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  description,
  icon: Icon,
  iconTone = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  children,
  disabled,
}) => (
  <div className={`flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between ${disabled ? 'opacity-60' : ''}`}>
    <div className="flex min-w-0 items-start gap-3.5">
      {Icon && (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
    </div>
    {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
  </div>
);

/** Rows container with hairline separators */
export const SettingsRows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
);

/** Key/value line for read-only facts */
export const InfoLine: React.FC<{ label: React.ReactNode; children: React.ReactNode; icon?: LucideIcon }> = ({ label, children, icon: Icon }) => (
  <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
    <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
    <span className="min-w-0 truncate text-right text-sm font-medium text-gray-900 dark:text-gray-100">{children}</span>
  </div>
);

export const SettingsLoader: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
      <Loader2 className="h-5 w-5 animate-spin" />
    </span>
    {label && <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>}
  </div>
);

/** Soft informational banner */
export const SettingsNote: React.FC<{ icon?: LucideIcon; tone?: 'info' | 'warning'; children: React.ReactNode }> = ({ icon: Icon, tone = 'info', children }) => (
  <div className={`flex items-start gap-3 rounded-3xl px-5 py-4 text-sm leading-relaxed ${
    tone === 'warning'
      ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
      : 'bg-acid-50 text-gray-700 shadow-[inset_0_0_0_1px_rgb(182_219_52/0.35)] dark:bg-acid-400/5 dark:text-gray-300 dark:shadow-[inset_0_0_0_1px_rgb(205_238_85/0.15)]'
  }`}>
    {Icon && <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'warning' ? 'text-amber-500' : 'text-acid-700 dark:text-acid-400'}`} />}
    <div className="min-w-0">{children}</div>
  </div>
);
