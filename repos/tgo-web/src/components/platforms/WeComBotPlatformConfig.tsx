import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Link2, ShieldCheck, Sparkles } from 'lucide-react';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import {
  ConfigCard,
  CopyField,
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
  platform: Platform; // expected: platform.type === 'wecom_bot'
}

const readConfig = (platform: Platform) => {
  const cfg = (platform.config || {}) as Record<string, unknown>;
  return {
    token: String(cfg.token ?? ''),
    encodingAESKey: String(cfg.encoding_aes_key ?? ''),
    // Convert relative callback URL to absolute
    callbackUrl: toAbsoluteUrl(platform.callback_url ?? ''),
  };
};

const WeComBotPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = useCopyToClipboard();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore(s => s.resetPlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.wecomBot.messages.enabled', 'Platform enabled'),
    disabled: t('platforms.wecomBot.messages.disabled', 'Platform disabled'),
    deleted: t('platforms.wecomBot.messages.deleteSuccess', 'Deleted successfully'),
    deletedDetail: t('platforms.wecomBot.messages.deleteSuccessMessage', 'WeCom bot platform deleted'),
  });
  const name = usePlatformName(platform);
  const ai = usePlatformAISettings(platform);
  const canSave = hasConfigChanges || name.changed || ai.changed;

  const [formValues, setFormValues] = useState(() => readConfig(platform));
  useEffect(() => { setFormValues(readConfig(platform)); }, [platform]);

  const handleChange = (patch: Partial<typeof formValues>) => {
    const next = { ...formValues, ...patch };
    setFormValues(next);
    // callbackUrl is derived from the backend and never saved
    const toSave: Partial<PlatformConfig> = { token: next.token, encodingAESKey: next.encodingAESKey };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (hasConfigChanges) {
        // Transform camelCase form values to snake_case API payload for WeCom Bot
        updates.config = {
          token: formValues.token.trim(),
          encoding_aes_key: formValues.encodingAESKey.trim(),
        };
      }
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());
      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
        if (hasConfigChanges) resetPlatformConfig(platform.id);
      }
      showSuccess(showToast, t('platforms.wecomBot.messages.saveSuccess', 'Saved successfully'), t('platforms.wecomBot.messages.saveSuccessMessage', 'WeCom bot configuration updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const guide = (
    <GuidePanel title={t('platforms.wecomBot.guide.title', 'WeCom Bot Setup Guide')}>
      <GuideNote icon={Sparkles} title={t('platforms.wecomBot.guide.overview', 'Quick Overview')}>
        {t('platforms.wecomBot.guide.overviewText', 'Complete three steps: ① create a smart bot in the Workbench → ② enter the callback URL in WeCom and get the Token and EncodingAESKey → ③ fill them back in on this platform and save.')}
      </GuideNote>

      <GuideStep index={1} title={t('platforms.wecomBot.guide.step1Title', '1️⃣ Create a WeCom smart bot')} defaultOpen>
        <ol>
          <li>{t('platforms.wecomBot.guide.step1Item1', 'Log in to the WeCom app and open "Workbench".')}</li>
          <li>{t('platforms.wecomBot.guide.step1Item2', 'Find and tap the "Smart Bot" app.')}</li>
          <li>{t('platforms.wecomBot.guide.step1Item3', 'Tap the "Create smart agent bot" button.')}</li>
          <li>{t('platforms.wecomBot.guide.step1Item4', 'Scroll to the bottom of the page and click the "Create in API mode" link.')}</li>
        </ol>
      </GuideStep>

      <GuideStep index={2} title={t('platforms.wecomBot.guide.step2Title', '2️⃣ Configure the callback URL and security info')}>
        <ol>
          <li>{t('platforms.wecomBot.guide.step2Item1', 'Copy the "Callback URL" on the left and paste it into the "URL" field on the WeCom bot configuration page.')}</li>
          <li>{t('platforms.wecomBot.guide.step2Item2', 'Click "Random generate" next to "Token", copy the generated Token and fill it into the "Token" field on the left.')}</li>
          <li>{t('platforms.wecomBot.guide.step2Item3', 'Click "Random generate" next to "EncodingAESKey", copy the generated key and fill it into the "EncodingAESKey" field on the left.')}</li>
          <li>{t('platforms.wecomBot.guide.step2Item4', 'Important: click Save on this platform now, then go back to the WeCom app and click "Done" to finish creating the bot.')}</li>
        </ol>
        <GuideNote tone="warning" icon={ShieldCheck} compact title={t('platforms.wecomBot.guide.step2SecurityTitle', 'Security Notice')}>
          {t('platforms.wecomBot.guide.step2SecurityText', 'Keep the Token and EncodingAESKey safe; they are used to verify the message source and to encrypt/decrypt messages.')}
        </GuideNote>
      </GuideStep>
    </GuidePanel>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.wecomBot.header.subtitle', 'Configure the credentials and callback needed to connect the WeCom bot (Webhook).')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.wecomBot.dialog.deleteTitle', 'Confirm Deletion'),
        message: t('platforms.wecomBot.dialog.deleteMessage', 'Are you sure you want to delete this WeCom bot platform? This action cannot be undone.'),
        confirmText: t('platforms.wecomBot.dialog.confirmDelete', 'Delete'),
        cancelText: t('platforms.wecomBot.dialog.cancel', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={guide}
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.wecomBot.form.name', 'Platform Name')}
        placeholder={t('platforms.wecomBot.form.namePlaceholder', 'Enter the platform name')}
      />

      <ConfigCard
        icon={Link2}
        title={t('platforms.common.sections.callback', 'Webhook')}
        description={t('platforms.common.sections.callbackDesc', 'Messages from the provider arrive at this address.')}
      >
        <Field label={t('platforms.wecomBot.form.callbackUrl', 'Callback URL')} hint={t('platforms.wecomBot.form.callbackUrlHint', 'Enter this URL in the "URL" setting of the WeCom smart bot.')}>
          <CopyField
            value={formValues.callbackUrl}
            placeholder={t('platforms.wecomBot.form.callbackUrlPlaceholder', 'The callback URL is generated after the platform is created')}
            onCopy={() => copy(formValues.callbackUrl, t('platforms.wecomBot.messages.urlCopied', 'Callback URL copied'))}
          />
        </Field>
      </ConfigCard>

      <ConfigCard
        icon={KeyRound}
        title={t('platforms.common.sections.credentials', 'Credentials')}
        description={t('platforms.common.sections.credentialsDesc', "Keys from the provider's developer console.")}
      >
        <Field label={t('platforms.wecomBot.form.token', 'Token')} htmlFor="wcb-token" hint={t('platforms.wecomBot.form.tokenHint', 'Must match the Token configured in the WeCom admin console.')}>
          <SecretInput
            id="wcb-token"
            value={formValues.token}
            onChange={(e) => handleChange({ token: e.target.value })}
            placeholder={t('platforms.wecomBot.form.tokenPlaceholder', 'Token used for callback verification')}
          />
        </Field>
        <Field label={t('platforms.wecomBot.form.encodingAESKey', 'EncodingAESKey')} htmlFor="wcb-aes" hint={t('platforms.wecomBot.form.encodingAESKeyHint', '43-character message encryption key, used to encrypt and decrypt callback messages.')}>
          <SecretInput
            id="wcb-aes"
            value={formValues.encodingAESKey}
            onChange={(e) => handleChange({ encodingAESKey: e.target.value })}
            placeholder={t('platforms.wecomBot.form.encodingAESKeyPlaceholder', '43-character message encryption key')}
          />
        </Field>
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default WeComBotPlatformConfig;
