/**
 * Building blocks for the platform (channel) screens, in the workflow page's
 * visual language: light display headings, ink/acid accents, white rounded
 * cards on a soft neutral canvas and pill-shaped controls.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Settings2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { Platform, PlatformAIMode, PlatformStatus } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import { getPlatformColor, getPlatformIconComponent, getPlatformLabel, toPlatformType } from '@/utils/platformUtils';

/* ---------- Status ---------- */

export interface StatusMeta {
  /** Tailwind background class for the status dot */
  dot: string;
  label: string;
  /** Tailwind classes for a filled status chip */
  chip: string;
  live: boolean;
}

export const useStatusMeta = () => {
  const { t } = useTranslation();
  return (status: PlatformStatus | string): StatusMeta => {
    switch (status) {
      case 'connected':
        return { dot: 'bg-acid-500', label: t('platforms.list.status.connected', 'Connected'), chip: 'bg-acid-300 text-ink-900', live: true };
      case 'error':
        return { dot: 'bg-red-500', label: t('platforms.list.status.error', 'Connection Failed'), chip: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', live: false };
      case 'pending':
        return { dot: 'bg-amber-400', label: t('platforms.list.status.pending', 'Pending Configuration'), chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', live: false };
      case 'disabled':
        return { dot: 'bg-gray-300 dark:bg-gray-600', label: t('platforms.status.disabled', 'Disabled'), chip: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', live: false };
      default:
        return { dot: 'bg-gray-300 dark:bg-gray-600', label: t('platforms.list.status.notConfigured', 'Not Configured'), chip: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', live: false };
    }
  };
};

/* ---------- Brand icon ---------- */

const ICON_SIZES = {
  sm: { box: 'h-9 w-9', icon: 16, dot: 'h-2.5 w-2.5' },
  md: { box: 'h-11 w-11', icon: 19, dot: 'h-3 w-3' },
  lg: { box: 'h-14 w-14', icon: 24, dot: 'h-3.5 w-3.5' },
} as const;

interface PlatformIconProps {
  type: string;
  size?: keyof typeof ICON_SIZES;
  /** Tailwind background class for a status dot in the corner */
  dot?: string;
  /** Ring color around the dot, matching the surface behind the icon */
  dotRing?: string;
  className?: string;
}

/** Brand glyph on a white disc, optionally with a status dot */
export const PlatformIcon: React.FC<PlatformIconProps> = ({
  type,
  size = 'md',
  dot,
  dotRing = 'ring-white dark:ring-gray-900',
  className = '',
}) => {
  const platformType = toPlatformType(type);
  const Icon = getPlatformIconComponent(platformType);
  const s = ICON_SIZES[size];
  return (
    <span className={`relative flex ${s.box} shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10 ${className}`}>
      <Icon size={s.icon} className={getPlatformColor(platformType)} />
      {dot && <span className={`absolute -bottom-0.5 -right-0.5 ${s.dot} rounded-full ring-2 ${dotRing} ${dot}`} />}
    </span>
  );
};

/* ---------- Lifecycle actions ---------- */

interface PlatformActionMessages {
  enabled: string;
  disabled: string;
  deleted: string;
  deletedDetail?: string;
}

/** Enable/disable and delete handling shared by every platform config screen */
export function usePlatformActions(platform: Platform, messages: PlatformActionMessages) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const enablePlatform = usePlatformStore(s => s.enablePlatform);
  const disablePlatform = usePlatformStore(s => s.disablePlatform);
  const deletePlatform = usePlatformStore(s => s.deletePlatform);
  const platforms = usePlatformStore(s => s.platforms);
  const [isToggling, setIsToggling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isEnabled = platform.status === 'connected';

  const toggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      if (isEnabled) {
        await disablePlatform(platform.id);
        showSuccess(showToast, messages.disabled);
      } else {
        await enablePlatform(platform.id);
        showSuccess(showToast, messages.enabled);
      }
    } catch (e) {
      showApiError(showToast, e);
    } finally {
      setIsToggling(false);
    }
  };

  const remove = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const idx = platforms.findIndex(p => p.id === platform.id);
      const nextId = idx !== -1
        ? (idx < platforms.length - 1 ? platforms[idx + 1]?.id : (idx > 0 ? platforms[idx - 1]?.id : null))
        : null;
      await deletePlatform(platform.id);
      showSuccess(showToast, messages.deleted, messages.deletedDetail);
      setConfirmOpen(false);
      navigate(nextId ? `/platforms/${nextId}` : '/platforms');
    } catch (e) {
      showApiError(showToast, e);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isEnabled,
    isToggling,
    toggle,
    confirmOpen,
    openDelete: () => setConfirmOpen(true),
    closeDelete: () => setConfirmOpen(false),
    isDeleting,
    remove,
  };
}

export type PlatformActions = ReturnType<typeof usePlatformActions>;

/* ---------- Shared form state ---------- */

/** Editable platform name with change tracking */
export function usePlatformName(platform: Platform) {
  const [name, setName] = useState<string>(platform.name);
  useEffect(() => { setName(platform.name); }, [platform.name]);
  const changed = useMemo(() => name.trim() !== platform.name, [name, platform.name]);
  return { name, setName, changed };
}

/** Controlled state for <PlatformAISettings /> plus the update payload */
export function usePlatformAISettings(platform: Platform) {
  const [agentIds, setAgentIds] = useState<string[]>(platform.agent_id ? [platform.agent_id] : []);
  const [aiMode, setAiMode] = useState<PlatformAIMode>(platform.ai_mode ?? 'auto');
  const [fallbackTimeout, setFallbackTimeout] = useState<number | null>(platform.fallback_to_ai_timeout ?? null);

  useEffect(() => {
    setAgentIds(platform.agent_id ? [platform.agent_id] : []);
    setAiMode(platform.ai_mode ?? 'auto');
    setFallbackTimeout(platform.fallback_to_ai_timeout ?? null);
  }, [platform.agent_id, platform.ai_mode, platform.fallback_to_ai_timeout]);

  const changed = useMemo(() => {
    const origAgentIds = platform.agent_id ? [platform.agent_id] : [];
    const agentIdsChanged = JSON.stringify([...agentIds].sort()) !== JSON.stringify([...origAgentIds].sort());
    return agentIdsChanged
      || aiMode !== (platform.ai_mode ?? 'auto')
      || fallbackTimeout !== (platform.fallback_to_ai_timeout ?? null);
  }, [agentIds, aiMode, fallbackTimeout, platform.agent_id, platform.ai_mode, platform.fallback_to_ai_timeout]);

  const updates = (): Pick<Platform, 'agent_id' | 'ai_mode' | 'fallback_to_ai_timeout'> => ({
    agent_id: agentIds[0] ?? null,
    ai_mode: aiMode,
    fallback_to_ai_timeout: aiMode === 'assist' ? fallbackTimeout : null,
  });

  const props = {
    platform,
    agentIds,
    aiMode,
    fallbackTimeout,
    onAgentIdsChange: setAgentIds,
    onAIModeChange: setAiMode,
    onFallbackTimeoutChange: setFallbackTimeout,
  };

  return { changed, updates, props };
}

/** Copies text to the clipboard and confirms with a toast; rethrows so CopyAction can react */
export function useCopyToClipboard() {
  const { showToast } = useToast();
  return async (text: string, message: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(showToast, message);
    } catch (e) {
      showApiError(showToast, e);
      throw e;
    }
  };
}

/* ---------- Page shell ---------- */

interface DeleteDialogText {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface PlatformConfigShellProps {
  platform: Platform;
  subtitle?: string;
  actions: PlatformActions;
  deleteDialog: DeleteDialogText;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  /** Extra header buttons rendered before Save (e.g. "Test connection") */
  extraActions?: React.ReactNode;
  /** Right column: guide or live preview */
  aside?: React.ReactNode;
  /** Full-width content under the two columns */
  after?: React.ReactNode;
  /** Dialogs and other portals */
  overlays?: React.ReactNode;
  /** Left column: form cards */
  children: React.ReactNode;
}

export const PlatformConfigShell: React.FC<PlatformConfigShellProps> = ({
  platform,
  subtitle,
  actions,
  deleteDialog,
  canSave,
  isSaving,
  onSave,
  extraActions,
  aside,
  after,
  overlays,
  children,
}) => {
  const { t } = useTranslation();
  const getStatusMeta = useStatusMeta();
  const status = getStatusMeta(platform.status);
  const displayName = platform.display_name || platform.name;
  const typeLabel = getPlatformLabel(toPlatformType(platform.type));
  const busy = isSaving || actions.isDeleting;

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1440px] space-y-8 px-6 py-8 md:px-10">
          {/* Header */}
          <header className="tgo-fade-up flex flex-col gap-6 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="flex min-w-0 items-start gap-5">
              <PlatformIcon type={platform.type} size="lg" dot={status.dot} dotRing="ring-gray-50 dark:ring-gray-950" className="mt-1 shadow-[0_14px_30px_-16px_rgb(15_16_18/0.45)]" />
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="tgo-eyebrow">{typeLabel}</span>
                  <span className={`inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold ${status.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.live ? 'bg-ink-900' : status.dot}`} />
                    {status.label}
                  </span>
                </div>
                <h2 className="tgo-display truncate text-[36px] text-gray-900 md:text-[44px] dark:text-white" title={displayName}>
                  {displayName}
                </h2>
                {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{subtitle}</p>}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={actions.openDelete}
                disabled={busy}
                aria-label={t('common.delete', 'Delete')}
                title={t('common.delete', 'Delete')}
                className="tgo-icon-btn h-11 w-11 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <StatusSwitch
                checked={actions.isEnabled}
                loading={actions.isToggling}
                disabled={busy}
                onToggle={actions.toggle}
              />
              {extraActions}
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave || isSaving}
                className="tgo-btn-ink"
                data-icon-motion="nudge"
              >
                <span className="tgo-btn-icon">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </span>
                {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </button>
            </div>
          </header>

          {/* Body */}
          <div className={`grid grid-cols-1 items-start gap-6 ${aside ? '2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]' : ''}`}>
            <div className="tgo-stagger min-w-0 space-y-6">{children}</div>
            {aside && <div className="min-w-0 2xl:sticky 2xl:top-6">{aside}</div>}
          </div>

          {after}

          {/* Floating save reminder */}
          {canSave && (
            <div className="pointer-events-none sticky bottom-6 z-20 flex justify-center">
              <div className="tgo-pop pointer-events-auto flex items-center gap-4 rounded-full bg-ink-900 py-1.5 pl-5 pr-1.5 text-sm text-white shadow-[0_24px_48px_-20px_rgb(15_16_18/0.9)] ring-1 ring-white/10 dark:bg-gray-800">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-acid-400" />
                  {t('platforms.common.unsavedChanges', 'You have unsaved changes')}
                </span>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-acid-400 px-4 text-xs font-semibold text-ink-900 transition-transform duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {overlays}
      <ConfirmDialog
        isOpen={actions.confirmOpen}
        title={deleteDialog.title}
        message={deleteDialog.message}
        confirmText={deleteDialog.confirmText ?? t('common.delete', 'Delete')}
        cancelText={deleteDialog.cancelText ?? t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        isLoading={actions.isDeleting}
        onCancel={actions.closeDelete}
        onConfirm={actions.remove}
      />
    </main>
  );
};

/* ---------- Switch ---------- */

interface StatusSwitchProps {
  checked: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/** Pill-shaped on/off switch showing whether the platform is live */
export const StatusSwitch: React.FC<StatusSwitchProps> = ({ checked, loading, disabled, onToggle }) => {
  const { t } = useTranslation();
  const label = loading
    ? (checked ? t('common.disabling', 'Disabling...') : t('common.enabling', 'Enabling...'))
    : (checked ? t('common.enabled', 'Enabled') : t('platforms.status.disabled', 'Disabled'));
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled || loading}
      title={checked ? t('common.disable', 'Disable') : t('common.enable', 'Enable')}
      className="inline-flex h-11 items-center gap-3 rounded-full bg-white pl-1.5 pr-5 text-sm font-medium text-gray-700 shadow-[inset_0_0_0_1px_var(--color-gray-200)] transition-all duration-200 hover:shadow-[inset_0_0_0_1px_var(--color-gray-300)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 dark:bg-gray-900 dark:text-gray-200 dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)]"
    >
      <span className={`relative flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${checked ? 'bg-acid-400' : 'bg-gray-200 dark:bg-gray-700'}`}>
        <span
          className={`absolute left-1 flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            checked ? 'translate-x-6 bg-ink-900 text-acid-400' : 'translate-x-0 bg-white text-gray-400'
          }`}
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        </span>
      </span>
      {label}
    </button>
  );
};

/* ---------- Cards ---------- */

interface ConfigCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Tailwind classes for the icon badge */
  iconTone?: string;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** White form section with an icon badge, title and description */
export const ConfigCard: React.FC<ConfigCardProps> = ({
  title,
  description,
  icon: Icon,
  iconTone = 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900',
  actions,
  className = '',
  children,
}) => (
  <section className={`tgo-surface p-6 md:p-7 ${className}`}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {Icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0 pt-0.5">
          <h3 className="text-lg font-medium tracking-tight text-gray-900 dark:text-white">{title}</h3>
          {description && <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
    {children && <div className="mt-6 space-y-5">{children}</div>}
  </section>
);

interface GeneralCardProps {
  name: string;
  onNameChange: (name: string) => void;
  label: string;
  placeholder?: string;
  /** Extra fields under the name */
  children?: React.ReactNode;
}

/** "General" card holding the platform name */
export const GeneralCard: React.FC<GeneralCardProps> = ({ name, onNameChange, label, placeholder, children }) => {
  const { t } = useTranslation();
  return (
    <ConfigCard
      icon={Settings2}
      title={t('platforms.common.sections.general', 'General')}
      description={t('platforms.common.sections.generalDesc', 'How this channel is named inside Pelatis.')}
    >
      <div>
        <label htmlFor="platform-name" className="tgo-label">{label}</label>
        <input
          id="platform-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={placeholder}
          className="tgo-input"
        />
      </div>
      {children}
    </ConfigCard>
  );
};

/* ---------- Inputs ---------- */

/** Small round button that sits inside an input on the right */
export const FieldAction: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'warning' }> = ({
  tone = 'default',
  className = '',
  children,
  ...rest
}) => (
  <button
    type="button"
    {...rest}
    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:pointer-events-none disabled:opacity-40 ${
      tone === 'warning'
        ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30'
        : 'text-gray-400 hover:bg-white hover:text-gray-900 hover:shadow-sm dark:hover:bg-gray-700 dark:hover:text-white'
    } ${className}`}
  >
    {children}
  </button>
);

/** Copy button that flips to a check mark once the copy succeeded */
export const CopyAction: React.FC<{ onCopy: () => Promise<void> | void; disabled?: boolean; label?: string }> = ({ onCopy, disabled, label }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const handleClick = async () => {
    try {
      await onCopy();
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const text = label || t('common.copy', 'Copy');
  return (
    <FieldAction onClick={handleClick} disabled={disabled} aria-label={text} title={text}>
      {copied ? <Check className="h-4 w-4 text-acid-600 dark:text-acid-400" /> : <Copy className="h-4 w-4" />}
    </FieldAction>
  );
};

const ACTION_PADDING = ['', 'pr-12', 'pr-[5.25rem]', 'pr-[7.5rem]'] as const;

interface InputWithActionsProps extends React.InputHTMLAttributes<HTMLInputElement> {
  actions?: React.ReactNode[];
  mono?: boolean;
}

/** `tgo-input` with round action buttons tucked inside on the right */
export const InputWithActions: React.FC<InputWithActionsProps> = ({ actions = [], mono, className = '', ...rest }) => {
  const visible = actions.filter(Boolean);
  return (
    <div className="relative">
      <input
        {...rest}
        className={`tgo-input ${ACTION_PADDING[Math.min(visible.length, 3)]} ${mono ? 'font-mono text-[13px] placeholder:font-sans placeholder:text-sm' : ''} ${rest.readOnly ? 'cursor-text !bg-gray-100/70 dark:!bg-gray-800/60' : ''} ${className}`}
      />
      {visible.length > 0 && (
        <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">{visible}</div>
      )}
    </div>
  );
};

interface CopyFieldProps {
  value: string;
  placeholder?: string;
  onCopy: () => Promise<void> | void;
  id?: string;
}

/** Read-only value (URL, endpoint) with a copy button */
export const CopyField: React.FC<CopyFieldProps> = ({ value, placeholder, onCopy, id }) => (
  <InputWithActions
    id={id}
    type="text"
    readOnly
    mono
    value={value}
    placeholder={placeholder}
    onFocus={(e) => e.currentTarget.select()}
    actions={[<CopyAction key="copy" onCopy={onCopy} disabled={!value} />]}
  />
);

interface SecretInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Extra actions placed after the visibility toggle */
  extraActions?: React.ReactNode[];
}

/** Password-style input with a show/hide toggle */
export const SecretInput: React.FC<SecretInputProps> = ({ extraActions = [], ...rest }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const label = visible ? t('common.hide', 'Hide') : t('common.show', 'Show');
  return (
    <InputWithActions
      {...rest}
      type={visible ? 'text' : 'password'}
      mono
      autoComplete="new-password"
      spellCheck={false}
      actions={[
        <FieldAction key="eye" onClick={() => setVisible(v => !v)} aria-label={label} title={label}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </FieldAction>,
        ...extraActions,
      ]}
    />
  );
};

/* ---------- Guide ---------- */

/** Drops a leading keycap emoji, pictograph or "1." from translated step titles */
const cleanTitle = (title: string): string =>
  title.replace(/^\s*(?:\d+️?⃣|\d+[.、)]|\p{Extended_Pictographic}️?)\s*/u, '').trim();

interface GuidePanelProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}

/** Right-hand setup guide card; scrolls on its own on wide screens */
export const GuidePanel: React.FC<GuidePanelProps> = ({ title, description, icon: Icon = BookOpen, children }) => {
  const { t } = useTranslation();
  return (
    <section className="tgo-surface tgo-fade-up custom-scrollbar p-6 md:p-7 2xl:max-h-[calc(100vh-3rem)] 2xl:overflow-y-auto">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acid-300 text-ink-900">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="tgo-eyebrow mb-1">{t('platforms.common.setupGuide', 'Setup guide')}</p>
          <h3 className="text-lg font-medium tracking-tight text-gray-900 dark:text-white">{cleanTitle(title)}</h3>
          {description && <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      <div className="mt-6 space-y-3">{children}</div>
    </section>
  );
};

interface GuideStepProps {
  index: number;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** Numbered, collapsible step in a setup guide */
export const GuideStep: React.FC<GuideStepProps> = ({ index, title, defaultOpen, children }) => (
  <details
    open={defaultOpen}
    className="group rounded-3xl bg-gray-50 ring-1 ring-black/[0.04] transition-colors duration-300 open:bg-white open:shadow-[0_14px_32px_-22px_rgb(15_16_18/0.35)] open:ring-gray-200 dark:bg-white/[0.03] dark:ring-white/5 dark:open:bg-gray-800/60 dark:open:ring-gray-700"
  >
    <summary className="flex cursor-pointer list-none items-center gap-4 rounded-3xl px-4 py-3.5 select-none [&::-webkit-details-marker]:hidden">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold tabular-nums text-gray-600 ring-1 ring-gray-200 transition-colors duration-300 group-open:bg-ink-900 group-open:text-acid-400 group-open:ring-transparent dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:group-open:bg-acid-400 dark:group-open:text-ink-900">
        {index}
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-900 dark:text-gray-100">{cleanTitle(title)}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
    </summary>
    <div className="tgo-guide space-y-3 px-4 pb-5 text-sm leading-relaxed text-gray-600 sm:pl-16 sm:pr-6 dark:text-gray-300">{children}</div>
  </details>
);

const NOTE_TONES = {
  info: 'bg-acid-50 text-gray-700 shadow-[inset_0_0_0_1px_rgb(182_219_52/0.35)] dark:bg-acid-400/5 dark:text-gray-300 dark:shadow-[inset_0_0_0_1px_rgb(205_238_85/0.15)]',
  warning: 'bg-amber-50 text-amber-900 shadow-[inset_0_0_0_1px_rgb(251_191_36/0.3)] dark:bg-amber-900/20 dark:text-amber-100 dark:shadow-[inset_0_0_0_1px_rgb(251_191_36/0.15)]',
  neutral: 'bg-gray-50 text-gray-700 shadow-[inset_0_0_0_1px_rgb(15_16_18/0.05)] dark:bg-white/[0.03] dark:text-gray-300 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]',
} as const;

const NOTE_ICON_TONES = {
  info: 'bg-acid-300 text-ink-900',
  warning: 'bg-amber-200 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300',
  neutral: 'bg-white text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
} as const;

interface GuideNoteProps {
  tone?: keyof typeof NOTE_TONES;
  icon?: LucideIcon;
  title?: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}

/** Soft callout used for overviews, tips and warnings */
export const GuideNote: React.FC<GuideNoteProps> = ({ tone = 'info', icon: Icon, title, children, compact }) => (
  <div className={`tgo-guide flex items-start gap-3 rounded-3xl ${compact ? 'px-4 py-3' : 'px-5 py-4'} text-sm leading-relaxed ${NOTE_TONES[tone]}`}>
    {Icon && (
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${NOTE_ICON_TONES[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    )}
    <div className="min-w-0 flex-1">
      {title && <p className="mb-1 font-semibold text-gray-900 dark:text-white">{typeof title === 'string' ? cleanTitle(title) : title}</p>}
      {children}
    </div>
  </div>
);

interface CodeBlockProps {
  code: string;
  /** Shown as a small caption above the code */
  label?: string;
  onCopy?: () => Promise<void> | void;
}

/** Ink terminal-style code block with an optional copy button */
export const CodeBlock: React.FC<CodeBlockProps> = ({ code, label, onCopy }) => (
  <div className="group/code relative overflow-hidden rounded-2xl bg-ink-900 text-gray-100 ring-1 ring-black/10 dark:bg-black/50 dark:ring-white/10">
    {(label || onCopy) && (
      <div className="flex items-center justify-between gap-3 border-b border-white/10 py-1.5 pl-4 pr-1.5">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-acid-400/80" />
          {label && <span className="ml-2 text-[11px] font-medium uppercase tracking-wider text-white/45">{label}</span>}
        </span>
        {onCopy ? (
          <span className="[&_button]:text-white/50 [&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button:hover]:shadow-none">
            <CopyAction onCopy={onCopy} />
          </span>
        ) : <span className="h-8" />}
      </div>
    )}
    <pre className="custom-scrollbar overflow-x-auto px-4 py-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{code}</pre>
  </div>
);

/** External documentation link styled as a small pill */
export const DocsLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    data-pill
    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-medium text-gray-700 shadow-[inset_0_0_0_1px_var(--color-gray-200)] transition-colors hover:bg-acid-300 hover:text-ink-900 hover:shadow-none dark:bg-gray-800 dark:text-gray-200 dark:shadow-[inset_0_0_0_1px_var(--color-gray-700)] dark:hover:bg-acid-400 dark:hover:text-ink-900"
  >
    <BookOpen className="h-3.5 w-3.5" />
    {children}
  </a>
);
