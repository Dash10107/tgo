/**
 * Page building blocks shared by the management screens (agents, tools, skills,
 * visitors, workflows). They follow the workflow page's visual language: light
 * display headings, ink call-to-action with an acid icon, pill filters and
 * notched white cards on a soft neutral canvas.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, Search, type LucideIcon } from 'lucide-react';

/* ---------- Shell ---------- */

export const PageShell: React.FC<{ children: React.ReactNode; after?: React.ReactNode }> = ({ children, after }) => (
  <main className="flex h-full min-w-0 flex-grow flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-12 px-6 py-8 md:px-10">{children}</div>
    </div>
    {after}
  </main>
);

/* ---------- Header ---------- */

export interface PageStat {
  key: string;
  value: number;
  label: string;
  /** Tailwind classes for the small badge above the label */
  badge: string;
  /** Badge text; defaults to the share of `total` as a percentage */
  badgeText?: string;
}

interface PageHeaderProps {
  title: string;
  /** Primary + secondary actions rendered beside the title */
  actions?: React.ReactNode;
  stats?: PageStat[];
  /** Denominator for the stat percentage badges */
  total?: number;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, actions, stats, total }) => (
  <header className="tgo-fade-up flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
    <div className="flex flex-wrap items-center gap-4 md:gap-5">
      <h2 className="tgo-display text-[44px] uppercase text-gray-900 md:text-[52px] dark:text-white">{title}</h2>
      {actions}
    </div>

    {stats && stats.length > 0 && (
      <div className="flex flex-wrap items-end gap-8 md:gap-12">
        {stats.map(stat => (
          <div key={stat.key} className="flex items-end gap-2">
            <span key={stat.value} className="tgo-pop tgo-display text-[44px] tabular-nums text-gray-900 dark:text-white">
              {stat.value}
            </span>
            <span className="mb-1 flex flex-col items-start gap-1">
              <span className={`rounded-full px-1.5 text-[10px] font-semibold leading-4 ${stat.badge}`}>
                {stat.badgeText ?? `${total && total > 0 ? Math.round((stat.value / total) * 100) : 0}%`}
              </span>
              <span className="text-sm text-gray-400 dark:text-gray-500">{stat.label}</span>
            </span>
          </div>
        ))}
      </div>
    )}
  </header>
);

/* ---------- Detail header ---------- */

interface DetailHeaderProps {
  title: string;
  description?: string;
  /** Small uppercase label above the title, e.g. the resource type */
  eyebrow?: string;
  icon?: LucideIcon;
  onBack?: () => void;
  backLabel?: string;
  /** Chips rendered under the description (tags etc.) */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

/** Header for a single-resource page: back pill, icon badge, title and actions */
export const DetailHeader: React.FC<DetailHeaderProps> = ({ title, description, eyebrow, icon: Icon, onBack, backLabel, meta, actions }) => {
  const { t } = useTranslation();
  const label = backLabel || t('common.back', 'Back');
  return (
    <header className="tgo-fade-up flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-4 md:gap-5">
        {onBack && (
          <button onClick={onBack} aria-label={label} title={label} className="tgo-icon-btn mt-1 h-11 w-11">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {Icon && (
          <span className="mt-0.5 hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-[0_12px_28px_-14px_rgb(15_16_18/0.8)] sm:flex dark:bg-acid-400 dark:text-ink-900">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="tgo-eyebrow mb-1.5">{eyebrow}</p>}
          <h2 className="tgo-display truncate text-[34px] text-gray-900 md:text-[40px] dark:text-white" title={title}>{title}</h2>
          {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
};

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Tailwind classes for the icon badge */
  tone?: string;
  hint?: React.ReactNode;
}

/** White metric tile with a large light figure */
export const StatTile: React.FC<StatTileProps> = ({ label, value, icon: Icon, tone = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', hint }) => (
  <div className="tgo-surface flex items-start justify-between gap-3 p-5">
    <div className="min-w-0">
      <p className="text-[13px] text-gray-500 dark:text-gray-400">{label}</p>
      <p className="tgo-display mt-3 truncate text-[36px] tabular-nums text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
    {Icon && (
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
    )}
  </div>
);

/** Full-height centered loader matching the page canvas */
export const PageLoader: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex h-full min-h-[50vh] w-full flex-grow flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
    <span className="relative flex h-14 w-14 items-center justify-center">
      <span className="tgo-pulse-ring absolute inset-0 rounded-full" />
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
    </span>
    {label && <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>}
  </div>
);

/* ---------- Buttons ---------- */

interface InkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  /** "nudge" slides the icon instead of rotating it on hover */
  motion?: 'rotate' | 'nudge';
}

/** Ink pill with a circular acid icon, the primary page action */
export const InkButton: React.FC<InkButtonProps> = ({ icon, motion = 'rotate', children, className = '', ...rest }) => (
  <button {...rest} className={`tgo-btn-ink ${className}`} data-icon-motion={motion === 'nudge' ? 'nudge' : undefined}>
    <span className="tgo-btn-icon">{icon}</span>
    {children}
  </button>
);

/** Outlined pill for secondary page actions */
export const GhostButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-gray-700 shadow-[inset_0_0_0_1px_var(--color-gray-200)] transition-all duration-200 hover:bg-acid-300 hover:text-ink-900 hover:shadow-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-900 dark:text-gray-200 dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)] dark:hover:bg-acid-400 dark:hover:text-ink-900 ${className}`}
  >
    {children}
  </button>
);

/* ---------- Section ---------- */

interface SectionHeaderProps {
  title: string;
  count?: number;
  countLabel?: string;
  /** Search, refresh and filter controls */
  children?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, count, countLabel, children }) => (
  <div className="flex flex-wrap items-center gap-3">
    <h3 className="mr-1 text-2xl font-light tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
    {typeof count === 'number' && (
      <span className="tgo-count mr-3"><b>{count}</b>{countLabel}</span>
    )}
    {children}
  </div>
);

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Wider resting width for longer placeholders */
  wide?: boolean;
}

/** Compact search pill that widens on focus */
export const SearchField: React.FC<SearchFieldProps> = ({ value, onChange, placeholder, wide }) => {
  const { t } = useTranslation();
  const label = placeholder || t('common.search', 'Search');
  return (
    <label className="group relative flex h-9 items-center">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400 transition-colors group-focus-within:text-ink-900 dark:group-focus-within:text-white" />
      <input
        type="text"
        placeholder={label}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 rounded-full bg-white pl-9 pr-4 text-sm text-gray-900 shadow-[inset_0_0_0_1px_var(--color-gray-200)] outline-none transition-all duration-300 placeholder:text-gray-400 ${wide ? 'w-64 focus:w-72' : 'w-44 focus:w-60'} focus:shadow-[inset_0_0_0_2px_var(--color-acid-400)] dark:bg-gray-900 dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)]`}
      />
    </label>
  );
};

export const RefreshButton: React.FC<{ onClick: () => void; spinning?: boolean; disabled?: boolean }> = ({ onClick, spinning, disabled }) => {
  const { t } = useTranslation();
  return (
    <button
      className="tgo-icon-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={t('common.refresh', 'Refresh')}
      title={t('common.refresh', 'Refresh')}
    >
      <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
    </button>
  );
};

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Tailwind background class for the leading dot */
  dot?: string;
}

interface FilterPillsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterPills<T extends string>({ options, value, onChange }: FilterPillsProps<T>): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist">
      {options.map(option => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
          className="tgo-pill"
        >
          {option.dot && <span className={`h-1.5 w-1.5 rounded-full ${option.dot}`} />}
          {option.label}
          {typeof option.count === 'number' && <span className="text-[11px] tabular-nums opacity-60">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Banner ---------- */

interface FeatureBannerProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

/** Acid-lime hero card, same treatment as the featured workflow template */
export const FeatureBanner: React.FC<FeatureBannerProps> = ({ icon: Icon, eyebrow, title, description, action }) => (
  <section className="tgo-fade-up relative overflow-hidden rounded-[28px] bg-acid-300 p-6 text-ink-900 md:p-8 dark:bg-acid-400">
    <span aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/25" />
    <span aria-hidden="true" className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/15" />
    <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-900/60">{eyebrow}</p>}
          <h3 className="mt-1 text-2xl font-medium tracking-tight">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-900/70">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  </section>
);

/* ---------- Card ---------- */

interface NotchCardProps {
  children: React.ReactNode;
  /** Round button cradled in the top-right notch */
  corner?: React.ReactNode;
  featured?: boolean;
  /** Lift the card above siblings (e.g. while a popover menu is open) */
  raised?: boolean;
  className?: string;
}

/** White card with the scooped top-right corner used on the workflow page */
export const NotchCard: React.FC<NotchCardProps> = ({ children, corner, featured, raised, className = '' }) => (
  <div className={`group relative h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 ${raised ? 'z-20' : ''} ${className}`}>
    <div
      aria-hidden="true"
      className={`absolute inset-0 rounded-[28px] ${corner ? 'tgo-notch' : ''} ${featured ? 'bg-acid-300 dark:bg-acid-400' : 'bg-white dark:bg-gray-800'}`}
    />
    <div className={`relative flex h-full flex-col p-5 ${featured ? 'text-ink-900' : 'text-gray-900 dark:text-gray-100'}`}>{children}</div>
    {corner && <div className="absolute right-1 top-1">{corner}</div>}
  </div>
);

/** Popover menu item used in card overflow menus */
export const MenuItem: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }> = ({ danger, className = '', children, ...rest }) => (
  <button
    role="menuitem"
    {...rest}
    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
      danger
        ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
    } ${className}`}
  >
    {children}
  </button>
);

export const MenuPanel: React.FC<{ children: React.ReactNode; placement?: 'top' | 'bottom' }> = ({ children, placement = 'bottom' }) => (
  <div
    role="menu"
    className={`animate-in fade-in zoom-in-95 absolute right-0 z-30 w-44 rounded-2xl border border-gray-100 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800 ${
      placement === 'top' ? 'bottom-full mb-2 slide-in-from-bottom-1' : 'top-full mt-2 slide-in-from-top-1'
    }`}
  >
    {children}
  </div>
);

/* ---------- States ---------- */

interface EmptyPanelProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyPanel: React.FC<EmptyPanelProps> = ({ icon: Icon, title, description, action }) => (
  <div className="tgo-surface tgo-fade-up flex flex-col items-center justify-center px-6 py-16 text-center">
    <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-acid-200/60 dark:bg-acid-400/10" />
      <span className="absolute inset-4 rounded-full bg-acid-300/70 dark:bg-acid-400/20" />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg">
        <Icon className="h-5 w-5" />
      </span>
    </div>
    <h3 className="mb-2 text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
    {description && <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    {action && <div className="mt-8">{action}</div>}
  </div>
);

export const ErrorPanel: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="tgo-surface flex flex-col items-center justify-center py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900/20">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="mb-1 font-medium text-gray-900 dark:text-gray-100">{t('common.error', 'Error')}</p>
      <p className="mb-6 max-w-md text-sm text-gray-500 dark:text-gray-400">{message}</p>
      {onRetry && (
        <InkButton onClick={onRetry} motion="nudge" icon={<RefreshCw className="h-4 w-4" />}>
          {t('common.retry', 'Retry')}
        </InkButton>
      )}
    </div>
  );
};

export const SkeletonGrid: React.FC<{ count?: number; className?: string; itemClassName?: string }> = ({
  count = 8,
  className = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  itemClassName = 'h-72',
}) => (
  <div className={className}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className={`tgo-skeleton rounded-[28px] ${itemClassName}`} style={{ opacity: 1 - i * 0.08 }} />
    ))}
  </div>
);

/** Shared responsive card grid with staggered entrance */
export const CardGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="tgo-stagger grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>
);
