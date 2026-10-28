import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Link2, ShieldCheck, Sparkles } from 'lucide-react';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import {
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
  platform: Platform; // expected: platform.type === 'dingtalk_bot'
}

const readConfig = (platform: Platform) => {
  const cfg = (platform.config || {}) as Record<string, unknown>;
  return {
    appKey: String(cfg.app_key ?? ''),
    appSecret: String(cfg.app_secret ?? ''),
    robotCode: String(cfg.robot_code ?? ''),
    aesKey: String(cfg.aes_key ?? ''),
    token: String(cfg.token ?? ''),
    // Convert relative callback URL to absolute
    callbackUrl: toAbsoluteUrl(platform.callback_url ?? ''),
  };
};

const DingTalkBotPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = useCopyToClipboard();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore(s => s.resetPlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.dingtalkBot.messages.enabled', 'Platform enabled'),
    disabled: t('platforms.dingtalkBot.messages.disabled', 'Platform disabled'),
    deleted: t('platforms.dingtalkBot.messages.deleteSuccess', 'Deleted Successfully'),
    deletedDetail: t('platforms.dingtalkBot.messages.deleteSuccessMessage', 'DingTalk Bot platform has been deleted'),
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
      appKey: next.appKey,
      appSecret: next.appSecret,
      robotCode: next.robotCode,
      aesKey: next.aesKey,
      token: next.token,
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (hasConfigChanges) {
        // Transform camelCase form values to snake_case API payload for DingTalk Bot
        updates.config = {
          app_key: formValues.appKey.trim(),
          app_secret: formValues.appSecret.trim(),
          robot_code: formValues.robotCode.trim(),
          aes_key: formValues.aesKey.trim(),
          token: formValues.token.trim(),
        };
      }
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());
      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
        if (hasConfigChanges) resetPlatformConfig(platform.id);
      }
      showSuccess(showToast, t('platforms.dingtalkBot.messages.saveSuccess', 'Saved Successfully'), t('platforms.dingtalkBot.messages.saveSuccessMessage', 'DingTalk Bot configuration has been updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const guide = (
    <GuidePanel title={t('platforms.dingtalkBot.guide.title', 'DingTalk Bot Configuration Guide')}>
      <GuideNote icon={Sparkles} title={t('platforms.dingtalkBot.guide.overview', 'Quick Overview')}>
        {t('platforms.dingtalkBot.guide.overviewText', 'Complete three steps: ① Create app/robot on DingTalk Open Platform → ② Configure receiver URL and get credentials → ③ Fill information back here and save.')}
      </GuideNote>

      <GuideStep index={1} title={t('platforms.dingtalkBot.guide.step1Title', '1️⃣ Create DingTalk App/Robot')} defaultOpen>
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.dingtalkBot.guide.step1Item1', 'Visit <a href="https://open.dingtalk.com/developer" target="_blank" rel="noreferrer">DingTalk Open Platform</a>, log in and enter developer backend.') }} />
          <li>{t('platforms.dingtalkBot.guide.step1Item2', "Click 'App Development' → 'Internal Development' → 'Create App'.")}</li>
          <li>{t('platforms.dingtalkBot.guide.step1Item3', 'Fill in app name, description, etc., and confirm creation.')}</li>
          <li>{t('platforms.dingtalkBot.guide.step1Item4', "In app details, find 'Robot' and click 'Create Robot'.")}</li>
        </ol>
      </GuideStep>

      <GuideStep index={2} title={t('platforms.dingtalkBot.guide.step2Title', '2️⃣ Configure Receiver and Security')}>
        <ol>
          <li>{t('platforms.dingtalkBot.guide.step2Item1', "In robot configuration, find 'Message Receiver Mode' and select 'HTTP Mode'.")}</li>
          <li>{t('platforms.dingtalkBot.guide.step2Item2', "Copy the 'Message Receiver URL' from the left and paste it into DingTalk.")}</li>
          <li>{t('platforms.dingtalkBot.guide.step2Item3', "In 'Credentials & Basic Info', copy 'AppKey' and 'AppSecret' and fill them on the left.")}</li>
          <li>{t('platforms.dingtalkBot.guide.step2Item4', "In robot configuration, copy 'RobotCode' and fill it into 'Robot Code' on the left.")}</li>
          <li>{t('platforms.dingtalkBot.guide.step2Item5', "In 'Dev Config' → 'Event Subscription', copy 'AES Key' and 'Token' and fill them on the left.")}</li>
        </ol>
        <GuideNote tone="warning" icon={ShieldCheck} compact title={t('platforms.dingtalkBot.guide.step2SecurityTitle', 'Security Tip')}>
          {t('platforms.dingtalkBot.guide.step2SecurityText', 'Keep AppSecret, AES Key, and Token safe; they are used for verification and encryption.')}
        </GuideNote>
      </GuideStep>

      <GuideStep index={3} title={t('platforms.dingtalkBot.guide.step3Title', '3️⃣ Publish App')}>
        <ol>
          <li>{t('platforms.dingtalkBot.guide.step3Item1', "Click 'Save' on this platform.")}</li>
          <li>{t('platforms.dingtalkBot.guide.step3Item2', "Go back to DingTalk, click 'Version Management & Release' → 'Create Version'.")}</li>
          <li>{t('platforms.dingtalkBot.guide.step3Item3', 'Submit for review; it will be ready after admin approval.')}</li>
        </ol>
        <DocsLink href="https://open.dingtalk.com/document/orgapp/robot-overview">{t('platforms.dingtalkBot.guide.docsLink', 'DingTalk Bot Dev Docs')}</DocsLink>
      </GuideStep>
    </GuidePanel>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.dingtalkBot.header.subtitle', 'Configure credentials and callbacks for DingTalk Bot integration.')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.dingtalkBot.dialog.deleteTitle', 'Confirm Delete'),
        message: t('platforms.dingtalkBot.dialog.deleteMessage', 'Are you sure you want to delete this DingTalk Bot platform? This action cannot be undone.'),
        confirmText: t('platforms.dingtalkBot.dialog.confirmDelete', 'Delete'),
        cancelText: t('platforms.dingtalkBot.dialog.cancel', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={guide}
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.dingtalkBot.form.name', 'Platform Name')}
        placeholder={t('platforms.dingtalkBot.form.namePlaceholder', 'Please enter platform name')}
      />

      <ConfigCard
        icon={Link2}
        title={t('platforms.common.sections.callback', 'Webhook')}
        description={t('platforms.common.sections.callbackDesc', 'Messages from the provider arrive at this address.')}
      >
        <Field label={t('platforms.dingtalkBot.form.callbackUrl', 'Message Receiver URL')} hint={t('platforms.dingtalkBot.form.callbackUrlHint', "Fill this URL into the 'Message Receiver URL' in DingTalk Bot configuration.")}>
          <CopyField
            value={formValues.callbackUrl}
            placeholder={t('platforms.dingtalkBot.form.callbackUrlPlaceholder', 'Receiver URL will be generated after creation')}
            onCopy={() => copy(formValues.callbackUrl, t('platforms.dingtalkBot.messages.urlCopied', 'Receiver URL copied'))}
          />
        </Field>
      </ConfigCard>

      <ConfigCard
        icon={KeyRound}
        title={t('platforms.common.sections.credentials', 'Credentials')}
        description={t('platforms.common.sections.credentialsDesc', "Keys from the provider's developer console.")}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('platforms.dingtalkBot.form.appKey', 'App Key')} htmlFor="dt-key" hint={t('platforms.dingtalkBot.form.appKeyHint', "Found in 'Credentials & Basic Info' of the app details on DingTalk Open Platform.")}>
            <input
              id="dt-key"
              type="text"
              value={formValues.appKey}
              onChange={(e) => handleChange({ appKey: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.appKeyPlaceholder', 'DingTalk App Key')}
              className="tgo-input font-mono text-[13px]"
            />
          </Field>
          <Field label={t('platforms.dingtalkBot.form.appSecret', 'App Secret')} htmlFor="dt-secret" hint={t('platforms.dingtalkBot.form.appSecretHint', "Found in 'Credentials & Basic Info' on DingTalk Open Platform, keep it safe.")}>
            <SecretInput
              id="dt-secret"
              value={formValues.appSecret}
              onChange={(e) => handleChange({ appSecret: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.appSecretPlaceholder', 'DingTalk App Secret')}
            />
          </Field>
        </div>
        <Field label={t('platforms.dingtalkBot.form.robotCode', 'Robot Code')} htmlFor="dt-robot" hint={t('platforms.dingtalkBot.form.robotCodeHint', 'Obtain from the robot configuration page on DingTalk Open Platform.')}>
          <input
            id="dt-robot"
            type="text"
            value={formValues.robotCode}
            onChange={(e) => handleChange({ robotCode: e.target.value })}
            placeholder={t('platforms.dingtalkBot.form.robotCodePlaceholder', 'Unique code for the DingTalk robot')}
            className="tgo-input font-mono text-[13px]"
          />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('platforms.dingtalkBot.form.aesKey', 'AES Key')} htmlFor="dt-aes" hint={t('platforms.dingtalkBot.form.aesKeyHint', 'Used to decrypt event messages from DingTalk, obtain from Open Platform.')}>
            <SecretInput
              id="dt-aes"
              value={formValues.aesKey}
              onChange={(e) => handleChange({ aesKey: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.aesKeyPlaceholder', 'Key for message encryption/decryption')}
            />
          </Field>
          <Field label={t('platforms.dingtalkBot.form.token', 'Token')} htmlFor="dt-token" hint={t('platforms.dingtalkBot.form.tokenHint', 'Used to verify event subscription request source, obtain from Open Platform.')}>
            <SecretInput
              id="dt-token"
              value={formValues.token}
              onChange={(e) => handleChange({ token: e.target.value })}
              placeholder={t('platforms.dingtalkBot.form.tokenPlaceholder', 'Token for signature verification')}
            />
          </Field>
        </div>
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default DingTalkBotPlatformConfig;
