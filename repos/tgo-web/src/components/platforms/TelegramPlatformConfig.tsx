import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Lightbulb, Link2, Sparkles } from 'lucide-react';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import {
  CodeBlock,
  ConfigCard,
  CopyField,
  DocsLink,
  GeneralCard,
  GuideNote,
  GuidePanel,
  GuideStep,
  PlatformConfigShell,
  SecretInput,
  useCopyToClipboard,
  usePlatformActions,
  usePlatformAISettings,
  usePlatformName,
} from '@/components/platforms/PlatformKit';
import { Field } from '@/components/ui/ModalKit';
import type { Platform, PlatformConfig } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import { toAbsoluteUrl } from '@/utils/config';

interface Props {
  platform: Platform; // expected: platform.type === 'telegram'
}

const readConfig = (platform: Platform) => {
  const cfg = (platform.config || {}) as Record<string, unknown>;
  return {
    botToken: String(cfg.bot_token ?? ''),
    webhookSecret: String(cfg.webhook_secret ?? ''),
    // Convert relative callback URL to absolute
    callbackUrl: toAbsoluteUrl(platform.callback_url ?? ''),
  };
};

const TelegramPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = useCopyToClipboard();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore(s => s.resetPlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.telegram.messages.enabled', 'Platform enabled'),
    disabled: t('platforms.telegram.messages.disabled', 'Platform disabled'),
    deleted: t('platforms.telegram.messages.deleteSuccess', 'Deleted Successfully'),
    deletedDetail: t('platforms.telegram.messages.deleteSuccessMessage', 'Telegram Bot platform has been deleted'),
  });
  const name = usePlatformName(platform);
  const ai = usePlatformAISettings(platform);
  const canSave = hasConfigChanges || name.changed || ai.changed;

  // Local form state sourced from platform.config
  const [formValues, setFormValues] = useState(() => readConfig(platform));
  useEffect(() => { setFormValues(readConfig(platform)); }, [platform]);

  const handleChange = (patch: Partial<typeof formValues>) => {
    const next = { ...formValues, ...patch };
    setFormValues(next);
    // callbackUrl is derived from the backend and never saved
    const toSave: Partial<PlatformConfig> = { botToken: next.botToken, webhookSecret: next.webhookSecret };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (hasConfigChanges) {
        // Transform camelCase form values to snake_case API payload for Telegram
        updates.config = {
          bot_token: formValues.botToken.trim(),
          webhook_secret: formValues.webhookSecret.trim(),
        };
      }
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());
      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
        if (hasConfigChanges) resetPlatformConfig(platform.id);
      }
      showSuccess(showToast, t('platforms.telegram.messages.saveSuccess', 'Saved Successfully'), t('platforms.telegram.messages.saveSuccessMessage', 'Telegram configuration has been updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const guide = (
    <GuidePanel title={t('platforms.telegram.guide.title', 'Telegram Bot Configuration Guide')}>
      <GuideNote icon={Sparkles} title={t('platforms.telegram.guide.overview', '✨ Quick Start')}>
        {t('platforms.telegram.guide.overviewText', "Steps: ①Create Bot & get Token → ②Enter Token → ③Click 'Enable'. System auto-configures Webhook!")}
      </GuideNote>

      <GuideStep index={1} title={t('platforms.telegram.guide.step1Title', '1️⃣ Create Telegram Bot')} defaultOpen>
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.telegram.guide.step1Item1', 'Search for <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> in Telegram and start a chat.') }} />
          <li>{t('platforms.telegram.guide.step1Item2', 'Send /newbot command to begin creating your robot.')}</li>
          <li>{t('platforms.telegram.guide.step1Item3', 'Enter a display name and a unique username (ending in _bot) as prompted.')}</li>
          <li>{t('platforms.telegram.guide.step1Item4', 'BotFather will return a Bot Token. Copy it for the next step.')}</li>
        </ol>
        <CodeBlock label="BotFather" code={'/newbot\n→ 123456789:ABCdefGHIjklMNOpqrsTUVwxyz'} />
      </GuideStep>

      <GuideStep index={2} title={t('platforms.telegram.guide.step2Title', '2️⃣ Configure and Enable')} defaultOpen>
        <ol>
          <li>{t('platforms.telegram.guide.step2Item1', "Paste the Token into the 'Bot Token' field on the left.")}</li>
          <li>{t('platforms.telegram.guide.step2Item2', "(Optional) Enter a 'Webhook Secret' for enhanced security.")}</li>
          <li>{t('platforms.telegram.guide.step2Item3', "Click 'Save', then click the 'Enable' button in the top right.")}</li>
        </ol>
        <GuideNote icon={Lightbulb} compact title={t('platforms.telegram.guide.step2AutoConfigTitle', '💡 Auto Configuration')}>
          {t('platforms.telegram.guide.step2AutoConfig', 'After enabling, the system automatically registers the Webhook address with Telegram. No manual setup needed.')}
        </GuideNote>
      </GuideStep>

      <GuideStep index={3} title={t('platforms.telegram.guide.step3Title', '3️⃣ Test Your Bot')}>
        <ol>
          <li>{t('platforms.telegram.guide.step3Item1', "Search for your Bot's username in Telegram and start a conversation.")}</li>
          <li>{t('platforms.telegram.guide.step3Item2', 'Send any message, and the AI will reply automatically.')}</li>
          <li>{t('platforms.telegram.guide.step3Item3', "To add your Bot to groups, ensure 'Allow Groups' is enabled in BotFather.")}</li>
        </ol>
        <DocsLink href="https://core.telegram.org/bots/api">{t('platforms.telegram.guide.docsLink', 'Telegram Bot API Docs')}</DocsLink>
      </GuideStep>
    </GuidePanel>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.telegram.header.subtitle', 'Configure credentials and callbacks for Telegram Bot.')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.telegram.dialog.deleteTitle', 'Confirm Delete'),
        message: t('platforms.telegram.dialog.deleteMessage', 'Are you sure you want to delete this Telegram Bot platform? This action cannot be undone.'),
        confirmText: t('platforms.telegram.dialog.confirmDelete', 'Delete'),
        cancelText: t('platforms.telegram.dialog.cancel', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={guide}
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.telegram.form.name', 'Platform Name')}
        placeholder={t('platforms.telegram.form.namePlaceholder', 'Please enter platform name')}
      />

      <ConfigCard
        icon={KeyRound}
        title={t('platforms.common.sections.credentials', 'Credentials')}
        description={t('platforms.common.sections.credentialsDesc', "Keys from the provider's developer console.")}
      >
        <Field
          label={t('platforms.telegram.form.botToken', 'Bot Token')}
          htmlFor="tg-token"
          hint={t('platforms.telegram.form.botTokenHint', 'Obtain the Token after creating your Bot via @BotFather, and keep it safe.')}
        >
          <SecretInput
            id="tg-token"
            value={formValues.botToken}
            onChange={(e) => handleChange({ botToken: e.target.value })}
            placeholder={t('platforms.telegram.form.botTokenPlaceholder', 'e.g.: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz')}
          />
        </Field>
        <Field
          label={t('platforms.telegram.form.webhookSecret', 'Webhook Secret (Optional)')}
          htmlFor="tg-secret"
          hint={t('platforms.telegram.form.webhookSecretHint', 'Set the same value via the secret_token parameter when calling setWebhook to verify request authenticity.')}
        >
          <SecretInput
            id="tg-secret"
            value={formValues.webhookSecret}
            onChange={(e) => handleChange({ webhookSecret: e.target.value })}
            placeholder={t('platforms.telegram.form.webhookSecretPlaceholder', 'Used to verify webhook request source')}
          />
        </Field>
      </ConfigCard>

      <ConfigCard
        icon={Link2}
        title={t('platforms.common.sections.callback', 'Webhook')}
        description={t('platforms.common.sections.callbackDesc', 'Messages from the provider arrive at this address.')}
      >
        <Field
          label={t('platforms.telegram.form.callbackUrl', 'Webhook URL')}
          hint={t('platforms.telegram.form.callbackUrlHint', "Use the setWebhook API to set this URL as your Bot's Webhook address.")}
        >
          <CopyField
            value={formValues.callbackUrl}
            placeholder={t('platforms.telegram.form.callbackUrlPlaceholder', 'Webhook URL will be generated after creation')}
            onCopy={() => copy(formValues.callbackUrl, t('platforms.telegram.messages.urlCopied', 'Webhook URL copied'))}
          />
        </Field>
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default TelegramPlatformConfig;
