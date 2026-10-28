import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Link2, ShieldCheck, Sparkles } from 'lucide-react';
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
  platform: Platform; // expected: platform.type === 'feishu_bot'
}

const readConfig = (platform: Platform) => {
  const cfg = (platform.config || {}) as Record<string, unknown>;
  return {
    appId: String(cfg.app_id ?? ''),
    appSecret: String(cfg.app_secret ?? ''),
    encryptKey: String(cfg.encrypt_key ?? ''),
    verificationToken: String(cfg.verification_token ?? ''),
    // Convert relative callback URL to absolute
    callbackUrl: toAbsoluteUrl(platform.callback_url ?? ''),
  };
};

const FeishuBotPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = useCopyToClipboard();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore(s => s.resetPlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.feishuBot.messages.enabled', 'Platform enabled'),
    disabled: t('platforms.feishuBot.messages.disabled', 'Platform disabled'),
    deleted: t('platforms.feishuBot.messages.deleteSuccess', 'Deleted Successfully'),
    deletedDetail: t('platforms.feishuBot.messages.deleteSuccessMessage', 'Feishu Bot platform has been deleted'),
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
    const toSave: Partial<PlatformConfig> = {
      appId: next.appId,
      appSecret: next.appSecret,
      encryptKey: next.encryptKey,
      verificationToken: next.verificationToken,
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (hasConfigChanges) {
        // Transform camelCase form values to snake_case API payload for Feishu Bot
        updates.config = {
          app_id: formValues.appId.trim(),
          app_secret: formValues.appSecret.trim(),
          encrypt_key: formValues.encryptKey.trim(),
          verification_token: formValues.verificationToken.trim(),
        };
      }
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());
      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
        if (hasConfigChanges) resetPlatformConfig(platform.id);
      }
      showSuccess(showToast, t('platforms.feishuBot.messages.saveSuccess', 'Saved Successfully'), t('platforms.feishuBot.messages.saveSuccessMessage', 'Feishu Bot configuration has been updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const guide = (
    <GuidePanel title={t('platforms.feishuBot.guide.title', 'Feishu Bot Configuration Guide')}>
      <GuideNote icon={Sparkles} title={t('platforms.feishuBot.guide.overview', 'Quick Overview')}>
        {t('platforms.feishuBot.guide.overviewText', 'Complete three steps: ① Create app/robot on Feishu Open Platform → ② Configure request URL and get Encrypt Key/Verification Token → ③ Fill information back here and save.')}
      </GuideNote>

      <GuideStep index={1} title={t('platforms.feishuBot.guide.step1Title', '1️⃣ Create Feishu App/Robot')} defaultOpen>
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.feishuBot.guide.step1Item1', 'Visit <a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer">Feishu Open Platform</a>, log in and enter developer backend.') }} />
          <li>{t('platforms.feishuBot.guide.step1Item2', "Click 'Create Custom App', fill in name and description.")}</li>
          <li>{t('platforms.feishuBot.guide.step1Item3', "Go to app details, find 'Robot' in left menu, and enable robot capability.")}</li>
        </ol>
      </GuideStep>

      <GuideStep index={2} title={t('platforms.feishuBot.guide.step2Title', '2️⃣ Configure Event Subscription')}>
        <ol>
          <li>{t('platforms.feishuBot.guide.step2Item1', "In app details, enter 'Event Subscription'.")}</li>
          <li>{t('platforms.feishuBot.guide.step2Item2', "Copy the 'Request URL' from the left and paste it into Feishu.")}</li>
          <li>{t('platforms.feishuBot.guide.step2Item3', "Find 'Encrypt Key' and 'Verification Token' on the page, copy and fill them on the left.")}</li>
          <li>{t('platforms.feishuBot.guide.step2Item4', "Add required events, e.g., 'Receive Messages' (im.message.receive_v1).")}</li>
        </ol>
        <CodeBlock label="Event" code="im.message.receive_v1" />
        <GuideNote tone="warning" icon={ShieldCheck} compact title={t('platforms.feishuBot.guide.step2SecurityTitle', 'Security Tip')}>
          {t('platforms.feishuBot.guide.step2SecurityText', 'Keep Encrypt Key and Verification Token safe; they are used for verification and decryption.')}
        </GuideNote>
      </GuideStep>

      <GuideStep index={3} title={t('platforms.feishuBot.guide.step3Title', '3️⃣ Publish App')}>
        <ol>
          <li>{t('platforms.feishuBot.guide.step3Item1', "Click 'Save' on this platform.")}</li>
          <li>{t('platforms.feishuBot.guide.step3Item2', "Go back to Feishu, click 'Version Management & Release' → 'Create Version'.")}</li>
          <li>{t('platforms.feishuBot.guide.step3Item3', 'Submit for review; it will be ready after admin approval.')}</li>
        </ol>
        <DocsLink href="https://open.feishu.cn/document/home/develop-a-bot-in-5-minutes/create-an-app">{t('platforms.feishuBot.guide.docsLink', 'Feishu Bot Dev Docs')}</DocsLink>
      </GuideStep>
    </GuidePanel>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.feishuBot.header.subtitle', 'Configure credentials and callbacks for Feishu Bot integration.')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.feishuBot.dialog.deleteTitle', 'Confirm Delete'),
        message: t('platforms.feishuBot.dialog.deleteMessage', 'Are you sure you want to delete this Feishu Bot platform? This action cannot be undone.'),
        confirmText: t('platforms.feishuBot.dialog.confirmDelete', 'Delete'),
        cancelText: t('platforms.feishuBot.dialog.cancel', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={guide}
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.feishuBot.form.name', 'Platform Name')}
        placeholder={t('platforms.feishuBot.form.namePlaceholder', 'Please enter platform name')}
      />

      <ConfigCard
        icon={Link2}
        title={t('platforms.common.sections.callback', 'Webhook')}
        description={t('platforms.common.sections.callbackDesc', 'Messages from the provider arrive at this address.')}
      >
        <Field label={t('platforms.feishuBot.form.callbackUrl', 'Request URL')} hint={t('platforms.feishuBot.form.callbackUrlHint', "Fill this URL into the 'Request URL' in Feishu Bot configuration.")}>
          <CopyField
            value={formValues.callbackUrl}
            placeholder={t('platforms.feishuBot.form.callbackUrlPlaceholder', 'Request URL will be generated after creation')}
            onCopy={() => copy(formValues.callbackUrl, t('platforms.feishuBot.messages.urlCopied', 'Request URL copied'))}
          />
        </Field>
      </ConfigCard>

      <ConfigCard
        icon={KeyRound}
        title={t('platforms.common.sections.credentials', 'Credentials')}
        description={t('platforms.common.sections.credentialsDesc', "Keys from the provider's developer console.")}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('platforms.feishuBot.form.appId', 'App ID')} htmlFor="fs-app-id" hint={t('platforms.feishuBot.form.appIdHint', "Found in 'Credentials & Basic Info' of the app details on Feishu Open Platform.")}>
            <input
              id="fs-app-id"
              type="text"
              value={formValues.appId}
              onChange={(e) => handleChange({ appId: e.target.value })}
              placeholder={t('platforms.feishuBot.form.appIdPlaceholder', 'Feishu App ID')}
              className="tgo-input font-mono text-[13px]"
            />
          </Field>
          <Field label={t('platforms.feishuBot.form.appSecret', 'App Secret')} htmlFor="fs-secret" hint={t('platforms.feishuBot.form.appSecretHint', "Found in 'Credentials & Basic Info' on Feishu Open Platform, keep it safe.")}>
            <SecretInput
              id="fs-secret"
              value={formValues.appSecret}
              onChange={(e) => handleChange({ appSecret: e.target.value })}
              placeholder={t('platforms.feishuBot.form.appSecretPlaceholder', 'Feishu App Secret')}
            />
          </Field>
        </div>
        <Field label={t('platforms.feishuBot.form.encryptKey', 'Encrypt Key')} htmlFor="fs-encrypt" hint={t('platforms.feishuBot.form.encryptKeyHint', 'Used to decrypt event messages from Feishu, obtain from Open Platform.')}>
          <SecretInput
            id="fs-encrypt"
            value={formValues.encryptKey}
            onChange={(e) => handleChange({ encryptKey: e.target.value })}
            placeholder={t('platforms.feishuBot.form.encryptKeyPlaceholder', 'Encryption key from Feishu Open Platform')}
          />
        </Field>
        <Field label={t('platforms.feishuBot.form.verificationToken', 'Verification Token')} htmlFor="fs-verify" hint={t('platforms.feishuBot.form.verificationTokenHint', 'Used to verify event subscription request source, obtain from Open Platform.')}>
          <SecretInput
            id="fs-verify"
            value={formValues.verificationToken}
            onChange={(e) => handleChange({ verificationToken: e.target.value })}
            placeholder={t('platforms.feishuBot.form.verificationTokenPlaceholder', 'Verification token from Feishu Open Platform')}
          />
        </Field>
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default FeishuBotPlatformConfig;
