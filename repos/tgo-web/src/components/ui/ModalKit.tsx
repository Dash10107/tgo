/**
 * Dialog and form building blocks in the workflow page's visual language:
 * a large rounded white sheet on a blurred backdrop, an ink/acid icon badge,
 * soft filled inputs and pill-shaped actions.
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X, type LucideIcon } from 'lucide-react';

/* ---------- Modal ---------- */

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export type ModalSize = keyof typeof SIZE_CLASSES;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  /** Tone of the header badge */
  tone?: 'ink' | 'acid' | 'danger' | 'warning';
  size?: ModalSize;
  /** Rendered in a sticky footer below the scrolling body */
  footer?: React.ReactNode;
  /** Wraps body + footer in a <form> */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Blocks backdrop/Escape/close-button dismissal (e.g. while saving) */
  preventClose?: boolean;
  /** Extra classes for the body (padding, spacing) */
  bodyClassName?: string;
  zIndex?: string;
  children: React.ReactNode;
}

const BADGE_TONES = {
  ink: 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900',
  acid: 'bg-acid-300 text-ink-900',
  danger: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
} as const;

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  tone = 'ink',
  size = 'md',
  footer,
  onSubmit,
  preventClose = false,
  bodyClassName = 'space-y-5',
  zIndex = 'z-50',
  children,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, preventClose, onClose]);

  if (!isOpen) return null;

  const body = (
    <>
      <div className={`custom-scrollbar flex-1 overflow-y-auto px-7 pb-6 pt-1 ${bodyClassName}`}>{children}</div>
      {footer && (
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-7 py-5 sm:flex-row sm:items-center sm:justify-end dark:border-gray-800">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4`}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gray-900/45 backdrop-blur-[6px] dark:bg-black/60"
        onClick={preventClose ? undefined : onClose}
      />
      <div role="dialog" aria-modal="true" className={`tgo-modal relative ${SIZE_CLASSES[size]}`}>
        <div className="flex items-start gap-4 px-7 pb-5 pt-7">
          {Icon && (
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${BADGE_TONES[tone]}`}>
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-xl font-medium tracking-tight text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={preventClose}
            aria-label={t('common.close', 'Close')}
            className="tgo-icon-btn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">{body}</form>
        ) : (
          body
        )}
      </div>
    </div>
  );
};

/* ---------- Buttons ---------- */

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  /** Label shown while loading */
  loadingText?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger';
}

/** Solid ink pill (acid in dark mode) used for the confirming action */
export const PrimaryButton: React.FC<ActionButtonProps> = ({
  loading,
  loadingText,
  icon,
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${
      variant === 'danger'
        ? 'bg-red-600 text-white shadow-[0_10px_24px_-12px_rgb(220_38_38/0.7)] hover:bg-red-700'
        : 'bg-ink-900 text-white shadow-[0_10px_24px_-12px_rgb(15_16_18/0.7)] hover:bg-ink-700 dark:bg-acid-400 dark:text-ink-900 dark:hover:bg-acid-300'
    } ${className}`}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
    {loading && loadingText ? loadingText : children}
  </button>
);

/** Outlined pill for cancel / secondary actions */
export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', type = 'button', ...rest }) => (
  <button {...rest} type={type} className={`tgo-pill h-11 justify-center px-6 text-sm disabled:pointer-events-none disabled:opacity-50 ${className}`}>
    {children}
  </button>
);

/* ---------- Fields ---------- */

interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Right-aligned helper on the label row, e.g. a character counter */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, required, optional, hint, error, aside, className = '', children }) => {
  const { t } = useTranslation();
  return (
    <div className={className}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="tgo-label">
              {label}
              {required && <span className="tgo-req">*</span>}
              {optional && <span className="tgo-opt">({t('common.optional', 'Optional')})</span>}
            </label>
          )}
          {aside && <span className="mb-2 text-[11px] tabular-nums text-gray-400">{aside}</span>}
        </div>
      )}
      {children}
      {error ? <p className="tgo-field-error">{error}</p> : hint ? <p className="tgo-hint">{hint}</p> : null}
    </div>
  );
};

/** Titled group of fields on a soft inset panel */
export const FieldGroup: React.FC<{ title?: React.ReactNode; icon?: LucideIcon; children: React.ReactNode; className?: string }> = ({
  title,
  icon: Icon,
  children,
  className = '',
}) => (
  <section className={`tgo-well space-y-5 p-5 ${className}`}>
    {title && (
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </h3>
    )}
    {children}
  </section>
);

/** Checkbox row styled as a soft tile */
export const CheckRow: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  trailing?: React.ReactNode;
}> = ({ checked, onChange, label, description, disabled, trailing }) => (
  <label className="tgo-option !py-3" data-active={checked} aria-disabled={disabled}>
    <input
      type="checkbox"
      className="tgo-check"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">{label}</span>
      {description && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{description}</span>}
    </span>
    {trailing}
  </label>
);
