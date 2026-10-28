import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, Inbox, Lightbulb, Loader2, Mail, PlugZap, Send, SlidersHorizontal, Wand2 } from 'lucide-react';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import {
  CodeBlock,
  ConfigCard,
  DocsLink,
  GeneralCard,
  GuideNote,
  GuidePanel,
  GuideStep,
  PlatformConfigShell,
  SecretInput,
  usePlatformActions,
  usePlatformAISettings,
  usePlatformName,
} from '@/components/platforms/PlatformKit';
import { CheckRow, Field } from '@/components/ui/ModalKit';
import type { Platform, PlatformConfig } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import { apiClient } from '@/services/api';

interface Props {
  platform: Platform; // expected: platform.type === 'email'
}

type EmailConfig = {
  imap_host: string;
  imap_port: number | '';
  imap_username: string;
  imap_password: string;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number | '';
  smtp_username: string;
  smtp_password: string;
  smtp_use_ssl: boolean;
  smtp_use_tls: boolean;
  use_same_credentials: boolean;
};

const defaultEmailConfig: EmailConfig = {
  imap_host: '',
  imap_port: 993,
  imap_username: '',
  imap_password: '',
  imap_use_ssl: true,
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_use_ssl: false,
  smtp_use_tls: true,
  use_same_credentials: true,
};

// Email provider configuration mapping
interface ProviderConfig {
  name: string;
  imap_host: string;
  imap_port: number;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_use_ssl: boolean;
  smtp_use_tls: boolean;
}

const OFFICE365 = {
  imap_host: 'outlook.office365.com',
  imap_port: 993,
  imap_use_ssl: true,
  smtp_host: 'smtp.office365.com',
  smtp_port: 587,
  smtp_use_ssl: false,
  smtp_use_tls: true,
};

const EMAIL_PROVIDERS: Record<string, ProviderConfig> = {
  'gmail.com': {
    name: 'Gmail',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  'qq.com': {
    name: 'QQ Mail',
    imap_host: 'imap.qq.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.qq.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
  'outlook.com': { name: 'Outlook', ...OFFICE365 },
  'hotmail.com': { name: 'Hotmail', ...OFFICE365 },
  'live.com': { name: 'Live', ...OFFICE365 },
  '163.com': {
    name: '163 Mail',
    imap_host: 'imap.163.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.163.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
  '126.com': {
    name: '126 Mail',
    imap_host: 'imap.126.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.126.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
};

const PROVIDER_TABLE = [
  { name: 'Gmail', imap: 'imap.gmail.com', imapPort: '993', smtp: 'smtp.gmail.com', smtpPort: '465/587' },
  { name: 'Outlook', imap: 'outlook.office365.com', imapPort: '993', smtp: 'smtp.office365.com', smtpPort: '587' },
  { name: 'QQ', imap: 'imap.qq.com', imapPort: '993', smtp: 'smtp.qq.com', smtpPort: '465/587' },
];

interface EmailConnectionTestResponse {
  smtp_status: string;
  smtp_message: string;
  imap_status: string;
  imap_message: string;
  overall_success: boolean;
}

// Extract domain from email address
const extractDomain = (email: string): string | null => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : null;
};

const toPort = (value: unknown, fallback: number): number => {
  if (typeof value === 'number') return value;
  if (value) return parseInt(String(value), 10) || fallback;
  return fallback;
};

const toBool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : value ? Boolean(value) : fallback);

const EmailPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const savePlatformConfig = usePlatformStore(s => s.savePlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);
  const [isTesting, setIsTesting] = useState(false);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.email.messages.enabled', 'Platform Enabled'),
    disabled: t('platforms.email.messages.disabled', 'Platform Disabled'),
    deleted: t('platforms.email.messages.deleteSuccess', 'Platform Deleted'),
    deletedDetail: t('platforms.email.messages.deleteSuccessMessage', 'Platform has been deleted'),
  });
  const name = usePlatformName(platform);
  const ai = usePlatformAISettings(platform);
  const canSave = hasConfigChanges || name.changed || ai.changed;

  // Simplified/Advanced mode state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoDetectedProvider, setAutoDetectedProvider] = useState<string | null>(null);
  const [manuallyEdited, setManuallyEdited] = useState(false);

  // Local form state sourced from platform.config
  const initialFormValues: EmailConfig = useMemo(() => {
    const cfg = (platform.config || {}) as Record<string, unknown>;
    return {
      imap_host: String(cfg.imap_host ?? defaultEmailConfig.imap_host),
      imap_port: toPort(cfg.imap_port, defaultEmailConfig.imap_port as number),
      imap_username: String(cfg.imap_username ?? defaultEmailConfig.imap_username),
      imap_password: String(cfg.imap_password ?? defaultEmailConfig.imap_password),
      imap_use_ssl: toBool(cfg.imap_use_ssl, defaultEmailConfig.imap_use_ssl),
      smtp_host: String(cfg.smtp_host ?? defaultEmailConfig.smtp_host),
      smtp_port: toPort(cfg.smtp_port, defaultEmailConfig.smtp_port as number),
      smtp_username: String(cfg.smtp_username ?? defaultEmailConfig.smtp_username),
      smtp_password: String(cfg.smtp_password ?? defaultEmailConfig.smtp_password),
      smtp_use_ssl: toBool(cfg.smtp_use_ssl, defaultEmailConfig.smtp_use_ssl),
      smtp_use_tls: toBool(cfg.smtp_use_tls, defaultEmailConfig.smtp_use_tls),
      use_same_credentials: toBool(cfg.use_same_credentials, defaultEmailConfig.use_same_credentials),
    };
  }, [platform.config]);

  const [formValues, setFormValues] = useState<EmailConfig>(initialFormValues);
  useEffect(() => { setFormValues(initialFormValues); }, [initialFormValues]);

  // Auto-detect email provider and fill configuration
  useEffect(() => {
    if (manuallyEdited) return; // Don't override manual edits

    const email = formValues.imap_username;
    const domain = email.includes('@') ? extractDomain(email) : null;
    const provider = domain ? EMAIL_PROVIDERS[domain] : undefined;
    if (!provider) {
      setAutoDetectedProvider(null);
      return;
    }

    setAutoDetectedProvider(provider.name);
    const detected = {
      imap_host: provider.imap_host,
      imap_port: provider.imap_port,
      imap_use_ssl: provider.imap_use_ssl,
      smtp_host: provider.smtp_host,
      smtp_port: provider.smtp_port,
      smtp_use_ssl: provider.smtp_use_ssl,
      smtp_use_tls: provider.smtp_use_tls,
      smtp_username: email,
      use_same_credentials: true,
    };
    // Saved settings that already match the provider are not a change
    const differs = (Object.keys(detected) as (keyof typeof detected)[]).some(k => formValues[k] !== detected[k]);
    if (!differs) return;
    setFormValues(prev => ({ ...prev, ...detected }));
    updatePlatformConfig(platform.id, detected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues.imap_username, manuallyEdited, platform.id, updatePlatformConfig]);

  const handleChange = (patch: Partial<EmailConfig>, isManualEdit = false) => {
    // Mark as manually edited if user changes advanced fields
    if (isManualEdit && showAdvanced) {
      setManuallyEdited(true);
    }

    const updated = { ...formValues, ...patch };
    // Auto-sync credentials if use_same_credentials is enabled
    if (updated.use_same_credentials) {
      if (patch.imap_username !== undefined) updated.smtp_username = patch.imap_username;
      if (patch.imap_password !== undefined) updated.smtp_password = patch.imap_password;
    }
    setFormValues(updated);

    // Accumulate changes into store for Save; empty ports are left out
    const { imap_port, smtp_port, ...rest } = updated;
    const toSave: Partial<PlatformConfig> = {
      ...rest,
      ...(imap_port !== '' ? { imap_port } : {}),
      ...(smtp_port !== '' ? { smtp_port } : {}),
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (hasConfigChanges) await savePlatformConfig(platform.id);
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());
      if (Object.keys(updates).length > 0) await updatePlatform(platform.id, updates);
      showSuccess(showToast, t('platforms.email.messages.saveSuccess', 'Saved Successfully'), t('platforms.email.messages.saveSuccessMessage', 'Email platform configuration has been saved'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const handleTestConnection = async () => {
    if (!formValues.imap_username || !formValues.imap_password || !formValues.imap_host || !formValues.imap_port ||
        !formValues.smtp_host || !formValues.smtp_port) {
      showToast('error', t('platforms.email.messages.testValidationError', 'Please fill in all required email configuration fields'));
      return;
    }

    setIsTesting(true);
    try {
      const requestBody = {
        imap_host: formValues.imap_host,
        imap_port: Number(formValues.imap_port),
        imap_username: formValues.imap_username,
        imap_password: formValues.imap_password,
        imap_use_ssl: formValues.imap_use_ssl,
        smtp_host: formValues.smtp_host,
        smtp_port: Number(formValues.smtp_port),
        smtp_username: formValues.use_same_credentials ? formValues.imap_username : formValues.smtp_username,
        smtp_password: formValues.use_same_credentials ? formValues.imap_password : formValues.smtp_password,
        smtp_use_tls: formValues.smtp_use_tls,
      };

      const response = await apiClient.post<EmailConnectionTestResponse>('/v1/email/test-connection', requestBody);

      if (response.overall_success) {
        showSuccess(
          showToast,
          t('platforms.email.messages.testSuccess', 'Connection Test Successful'),
          t('platforms.email.messages.testSuccessMessage', 'Both IMAP and SMTP connections are working')
        );
      } else {
        const errorDetails: string[] = [];
        if (response.smtp_status !== 'success') errorDetails.push(`SMTP: ${response.smtp_message}`);
        if (response.imap_status !== 'success') errorDetails.push(`IMAP: ${response.imap_message}`);
        showToast('error', t('platforms.email.messages.testFailed', 'Connection Test Failed'), errorDetails.join('\n'));
      }
    } catch (e) {
      showApiError(showToast, e);
    } finally {
      setIsTesting(false);
    }
  };

  const portValue = (value: string): number | '' => (value === '' ? '' : parseInt(value, 10) || '');
  const autoFilled = autoDetectedProvider ? '!bg-acid-50 dark:!bg-acid-400/5' : '';

  const guide = (
    <GuidePanel title={t('platforms.email.guide.title', 'Email Platform Configuration Guide (IMAP Receiving + SMTP Sending)')}>
      <GuideNote icon={Lightbulb} title={t('platforms.email.guide.tipTitle', 'Tip')}>
        <span dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.tipMessage', 'IMAP is for receiving emails, SMTP is for sending emails. Common ports: <code>IMAP SSL=993</code>, <code>SMTP SSL=465</code>, <code>SMTP TLS=587</code>.') }} />
      </GuideNote>

      <GuideStep index={1} title={t('platforms.email.guide.section1Title', '1. Get Email Credentials (General Steps)')} defaultOpen>
        <ol>
          <li>{t('platforms.email.guide.section1Step1', 'Log in to your email service provider account (Gmail / Outlook / QQ Mail, etc.).')}</li>
          <li>{t('platforms.email.guide.section1Step2', "Go to 'Account Settings' or 'Security' page, enable IMAP/SMTP service (if required).")}</li>
          <li>{t('platforms.email.guide.section1Step3', "If required by the service provider (such as Gmail/QQ), enable two-step verification and create an 'App-specific password'.")}</li>
          <li>{t('platforms.email.guide.section1Step4', "Fill in IMAP and SMTP configuration in the left form. If using same credentials, check 'Use Same Credentials for SMTP'.")}</li>
          <li>{t('platforms.email.guide.section1Step5', "Click 'Save' in the upper right corner, then test sending and receiving emails.")}</li>
        </ol>
      </GuideStep>

      <GuideStep index={2} title={t('platforms.email.guide.section2Title', '2. Common Email Servers and Ports')} defaultOpen>
        <div className="custom-scrollbar overflow-x-auto rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400 dark:bg-white/[0.03]">
              <tr>
                <th className="px-4 py-2.5 font-semibold">{t('platforms.email.guide.tableProvider', 'Provider')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('platforms.email.guide.tableImapServer', 'IMAP Server')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('platforms.email.guide.tableImapPort', 'IMAP Port')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('platforms.email.guide.tableSmtpServer', 'SMTP Server')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('platforms.email.guide.tableSmtpPort', 'SMTP Port')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {PROVIDER_TABLE.map(row => (
                <tr key={row.name} className="transition-colors hover:bg-acid-50/60 dark:hover:bg-acid-400/5">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                    {row.name === 'QQ' ? t('platforms.email.guide.tableQQMail', 'QQ Mail') : row.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.imap}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.imapPort}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.smtp}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.smtpPort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GuideStep>

      <GuideStep index={3} title={t('platforms.email.guide.gmailTitle', 'Gmail (App-specific Password)')}>
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep1', 'Go to Google Account Security Center → Two-step Verification → App-specific Password; confirm IMAP/SMTP is enabled.') }} />
          <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep2', 'IMAP server: <code>imap.gmail.com</code>, port: 993 (SSL).') }} />
          <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep3', 'SMTP server: <code>smtp.gmail.com</code>, port: 465 (SSL) or 587 (TLS).') }} />
          <li>{t('platforms.email.guide.gmailStep4', 'Username is your Gmail address; password uses app-specific password (same for IMAP and SMTP).')}</li>
        </ol>
        <CodeBlock label="Gmail" code={`IMAP_HOST=imap.gmail.com\nIMAP_PORT=993\nSMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nUSERNAME=you@gmail.com\nPASSWORD=${t('platforms.email.guide.gmailPasswordPlaceholder', 'App-specific password')}\nUSE_SAME_CREDENTIALS=true`} />
        <DocsLink href="https://support.google.com/accounts/answer/185833">{t('platforms.email.guide.gmailDocs', 'Gmail Official Guide')}</DocsLink>
      </GuideStep>

      <GuideStep index={4} title={t('platforms.email.guide.outlookTitle', 'Outlook（Office 365）')}>
        <ul>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.outlookStep1', 'IMAP server: <code>outlook.office365.com</code>, port: 993 (SSL).') }} />
          <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.outlookStep2', 'SMTP server: <code>smtp.office365.com</code>, port: 587 (TLS).') }} />
          <li>{t('platforms.email.guide.outlookStep3', 'Username is usually the email address; IMAP and SMTP use same credentials.')}</li>
        </ul>
        <CodeBlock label="Outlook" code={'IMAP_HOST=outlook.office365.com\nIMAP_PORT=993\nSMTP_HOST=smtp.office365.com\nSMTP_PORT=587\nUSERNAME=you@outlook.com\nUSE_SAME_CREDENTIALS=true'} />
        <DocsLink href="https://learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/pop-imap-smtp-settings">{t('platforms.email.guide.outlookDocs', 'Microsoft Documentation')}</DocsLink>
      </GuideStep>

      <GuideStep index={5} title={t('platforms.email.guide.qqTitle', 'QQ Mail (Enable IMAP/SMTP Required)')}>
        <ol>
          <li>{t('platforms.email.guide.qqStep1', "Go to QQ Mail Settings → Account → Enable 'IMAP/SMTP Service'.")}</li>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.qqStep2', 'Get authorization code as password; IMAP server: <code>imap.qq.com</code>, port: 993.') }} />
          <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.qqStep3', 'SMTP server: <code>smtp.qq.com</code>, port: 465 (SSL) or 587 (TLS).') }} />
          <li>{t('platforms.email.guide.qqStep4', 'IMAP and SMTP use the same authorization code.')}</li>
        </ol>
        <CodeBlock label="QQ Mail" code={`IMAP_HOST=imap.qq.com\nIMAP_PORT=993\nSMTP_HOST=smtp.qq.com\nSMTP_PORT=465\nUSERNAME=your_qq@qq.com\nPASSWORD=${t('platforms.email.guide.qqPasswordPlaceholder', 'Authorization code')}\nUSE_SAME_CREDENTIALS=true`} />
        <DocsLink href="https://wx.mail.qq.com/list/readtemplate?name=app_intro.html#/agreement/authorizationCode">{t('platforms.email.guide.qqDocs', 'QQ Mail Help')}</DocsLink>
      </GuideStep>

      <GuideNote tone="warning" icon={AlertTriangle} title={t('platforms.email.guide.troubleshootTitle', 'Troubleshooting Guide')}>
        <ul>
          <li>{t('platforms.email.guide.troubleshootItem1', 'Confirm that the service provider has enabled IMAP/SMTP service; Gmail/QQ need to enable in settings and use app-specific password/authorization code.')}</li>
          <li>{t('platforms.email.guide.troubleshootItem2', 'IMAP: prioritize SSL (port 993); SMTP: recommend TLS (port 587) or SSL (port 465).')}</li>
          <li>{t('platforms.email.guide.troubleshootItem3', 'Verify that the email address (username) and password are correct, pay attention to case and spaces.')}</li>
          <li>{t('platforms.email.guide.troubleshootItem4', "If 'Use Same Credentials' is checked, ensure IMAP and SMTP use the same username and password.")}</li>
          <li>{t('platforms.email.guide.troubleshootItem5', 'If still failing, check if you need to allow third-party client access in the service provider backend.')}</li>
        </ul>
      </GuideNote>

      <p className="px-1 text-xs text-gray-400">{t('platforms.email.guide.moreInfo', 'More documentation: Official documentation and support pages of each email service provider.')}</p>
    </GuidePanel>
  );

  const testButton = (
    <button
      type="button"
      onClick={handleTestConnection}
      disabled={isTesting}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-gray-700 shadow-[inset_0_0_0_1px_var(--color-gray-200)] transition-all duration-200 hover:bg-acid-300 hover:text-ink-900 hover:shadow-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 dark:bg-gray-900 dark:text-gray-200 dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)] dark:hover:bg-acid-400 dark:hover:text-ink-900"
    >
      {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
      {isTesting ? t('platforms.email.buttons.testing', 'Testing...') : t('platforms.email.buttons.testConnection', 'Test Connection')}
    </button>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.email.header.subtitle', 'Configure IMAP (receiving) and SMTP (sending) information.')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.email.confirm.deleteTitle', 'Delete Platform'),
        message: t('platforms.email.confirm.deleteMessage', 'Are you sure you want to delete this platform?'),
        confirmText: t('platforms.email.confirm.confirmText', 'Delete'),
        cancelText: t('platforms.email.confirm.cancelText', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      extraActions={testButton}
      aside={guide}
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.email.form.name', 'Platform Name')}
        placeholder={t('platforms.email.form.namePlaceholder', 'Enter platform name')}
      />

      <ConfigCard
        icon={Mail}
        title={t('platforms.email.form.mailbox', 'Mailbox')}
        description={t('platforms.email.form.mailboxDesc', 'Sign in with the address customers write to. Common providers are set up automatically.')}
      >
        <Field
          label={t('platforms.email.form.emailAddress', 'Email Address')}
          htmlFor="email-address"
          required
        >
          <input
            id="email-address"
            type="email"
            value={formValues.imap_username}
            onChange={(e) => handleChange({ imap_username: e.target.value })}
            placeholder={t('platforms.email.form.emailPlaceholder', 'you@example.com')}
            className="tgo-input"
            autoComplete="off"
          />
          {autoDetectedProvider && (
            <p className="tgo-pop mt-2 inline-flex items-center gap-1.5 rounded-full bg-acid-300 px-2.5 py-1 text-xs font-medium text-ink-900">
              <Wand2 className="h-3.5 w-3.5" />
              {t('platforms.email.form.autoDetected', 'Auto-detected as')} {autoDetectedProvider}
            </p>
          )}
        </Field>
        <Field
          label={t('platforms.email.form.emailPassword', 'Email Password')}
          htmlFor="email-password"
          required
          hint={t('platforms.email.form.passwordHint', 'Gmail/QQ Mail requires app-specific password or authorization code')}
        >
          <SecretInput
            id="email-password"
            value={formValues.imap_password}
            onChange={(e) => handleChange({ imap_password: e.target.value })}
            placeholder={t('platforms.email.form.passwordPlaceholder', 'Enter email password or authorization code')}
          />
        </Field>
      </ConfigCard>

      {/* Advanced server settings */}
      <section className="tgo-surface">
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          aria-expanded={showAdvanced}
          className="group flex w-full items-center gap-4 rounded-[1.75rem] p-6 text-left md:px-7"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-medium tracking-tight text-gray-900 dark:text-white">
              {showAdvanced ? t('platforms.email.form.hideAdvanced', 'Hide Advanced Settings') : t('platforms.email.form.showAdvanced', 'Show Advanced Settings')}
            </span>
            <span className="mt-1 block truncate font-mono text-xs text-gray-500 dark:text-gray-400">
              IMAP {formValues.imap_host || '—'}:{formValues.imap_port || '—'} · SMTP {formValues.smtp_host || '—'}:{formValues.smtp_port || '—'}
            </span>
          </span>
          <span className="tgo-icon-btn pointer-events-none group-hover:bg-acid-300 group-hover:text-ink-900 group-hover:shadow-none">
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-1 space-y-4 px-6 pb-7 md:px-7">
            {/* IMAP */}
            <div className="tgo-well space-y-4 p-5">
              <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                <Inbox className="h-3.5 w-3.5" />
                {t('platforms.email.form.imapSection', 'IMAP Configuration (Receiving Emails)')}
              </h4>
              <Field label={t('platforms.email.form.imapHost', 'IMAP Server')} htmlFor="imap-host">
                <input
                  id="imap-host"
                  type="text"
                  value={formValues.imap_host}
                  onChange={(e) => handleChange({ imap_host: e.target.value }, true)}
                  placeholder={t('platforms.email.form.imapHostPlaceholder', 'e.g., imap.gmail.com')}
                  className={`tgo-input font-mono text-[13px] ${autoFilled}`}
                />
              </Field>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field label={t('platforms.email.form.imapPort', 'IMAP Port')} htmlFor="imap-port">
                  <input
                    id="imap-port"
                    type="number"
                    value={formValues.imap_port}
                    onChange={(e) => handleChange({ imap_port: portValue(e.target.value) }, true)}
                    placeholder="993"
                    className={`tgo-input tabular-nums ${autoFilled}`}
                  />
                </Field>
                <CheckRow
                  checked={formValues.imap_use_ssl}
                  onChange={(checked) => handleChange({ imap_use_ssl: checked }, true)}
                  label={t('platforms.email.form.useSsl', 'Use SSL')}
                />
              </div>
            </div>

            {/* SMTP */}
            <div className="tgo-well space-y-4 p-5">
              <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                <Send className="h-3.5 w-3.5" />
                {t('platforms.email.form.smtpSection', 'SMTP Configuration (Sending Emails)')}
              </h4>
              <CheckRow
                checked={formValues.use_same_credentials}
                onChange={(checked) => handleChange({ use_same_credentials: checked })}
                label={t('platforms.email.form.useSameCredentials', 'Use Same Credentials for SMTP (Recommended)')}
              />
              <Field label={t('platforms.email.form.smtpHost', 'SMTP Server')} htmlFor="smtp-host">
                <input
                  id="smtp-host"
                  type="text"
                  value={formValues.smtp_host}
                  onChange={(e) => handleChange({ smtp_host: e.target.value }, true)}
                  placeholder={t('platforms.email.form.smtpHostPlaceholder', 'e.g., smtp.gmail.com')}
                  className={`tgo-input font-mono text-[13px] ${autoFilled}`}
                />
              </Field>
              <Field label={t('platforms.email.form.smtpPort', 'SMTP Port')} htmlFor="smtp-port">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="smtp-port"
                    type="number"
                    value={formValues.smtp_port}
                    onChange={(e) => handleChange({ smtp_port: portValue(e.target.value) }, true)}
                    placeholder="587"
                    className={`tgo-input w-32 tabular-nums ${autoFilled}`}
                  />
                  <div className="tgo-tabs" role="radiogroup" aria-label={t('platforms.email.form.smtpSecurity', 'Encryption')}>
                    {(['ssl', 'tls'] as const).map(mode => {
                      const active = mode === 'ssl' ? formValues.smtp_use_ssl : formValues.smtp_use_tls;
                      return (
                        <button
                          key={mode}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          data-active={active}
                          className="tgo-tab"
                          onClick={() => handleChange(
                            mode === 'ssl'
                              ? { smtp_use_ssl: !formValues.smtp_use_ssl, smtp_use_tls: !formValues.smtp_use_ssl ? false : formValues.smtp_use_tls }
                              : { smtp_use_tls: !formValues.smtp_use_tls, smtp_use_ssl: !formValues.smtp_use_tls ? false : formValues.smtp_use_ssl },
                            true
                          )}
                        >
                          {mode.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Field>

              {!formValues.use_same_credentials && (
                <div className="animate-in fade-in slide-in-from-top-1 grid gap-4 md:grid-cols-2">
                  <Field label={t('platforms.email.form.smtpUsername', 'SMTP Username')} htmlFor="smtp-user">
                    <input
                      id="smtp-user"
                      type="email"
                      value={formValues.smtp_username}
                      onChange={(e) => handleChange({ smtp_username: e.target.value }, true)}
                      placeholder={t('platforms.email.form.smtpUsernamePlaceholder', 'Usually same as email address')}
                      className="tgo-input"
                    />
                  </Field>
                  <Field label={t('platforms.email.form.smtpPassword', 'SMTP Password')} htmlFor="smtp-pass">
                    <SecretInput
                      id="smtp-pass"
                      value={formValues.smtp_password}
                      onChange={(e) => handleChange({ smtp_password: e.target.value }, true)}
                      placeholder={t('platforms.email.form.smtpPasswordPlaceholder', 'Enter SMTP password')}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default EmailPlatformConfig;
