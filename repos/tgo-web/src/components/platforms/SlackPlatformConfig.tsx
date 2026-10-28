import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Sparkles } from 'lucide-react';
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
import { Field } from '@/components/ui/ModalKit';
import type { Platform, PlatformConfig } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';

interface Props {
  platform: Platform; // expected: platform.type === 'slack'
}

const readConfig = (platform: Platform) => {
  const cfg = (platform.config || {}) as Record<string, unknown>;
  return {
    botToken: String(cfg.bot_token ?? ''),
    appToken: String(cfg.app_token ?? ''),
    signingSecret: String(cfg.signing_secret ?? ''),
  };
};

const SlackPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore(s => s.resetPlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.slack.messages.enabled', 'Platform enabled'),
    disabled: t('platforms.slack.messages.disabled', 'Platform disabled'),
    deleted: t('platforms.slack.messages.deleteSuccess', 'Deleted successfully'),
    deletedDetail: t('platforms.slack.messages.deleteSuccessMessage', 'Slack Bot platform deleted'),
  });
  const name = usePlatformName(platform);
  const ai = usePlatformAISettings(platform);
  const canSave = hasConfigChanges || name.changed || ai.changed;

  const [formValues, setFormValues] = useState(() => readConfig(platform));
  useEffect(() => { setFormValues(readConfig(platform)); }, [platform]);

  const handleChange = (patch: Partial<typeof formValues>) => {
    setFormValues(v => ({ ...v, ...patch }));
    const toSave: Partial<PlatformConfig> = { ...patch };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (hasConfigChanges) {
        updates.config = {
          bot_token: formValues.botToken.trim(),
          app_token: formValues.appToken.trim(),
          signing_secret: formValues.signingSecret.trim(),
        };
      }
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());
      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
        if (hasConfigChanges) resetPlatformConfig(platform.id);
      }
      showSuccess(showToast, t('platforms.slack.messages.saveSuccess', 'Saved successfully'), t('platforms.slack.messages.saveSuccessMessage', 'Slack Bot configuration updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const guide = (
    <GuidePanel title={t('platforms.slack.guide.title', 'Slack Bot Configuration Guide')}>
      <GuideNote icon={Sparkles} title={t('platforms.slack.guide.overview', 'Quick Overview')}>
        {t('platforms.slack.guide.overviewText', 'Complete these steps: ① Create Slack App -> ② Enable Socket Mode & get App Token -> ③ Configure Bot permissions & event subscriptions -> ④ Install to workspace & get Bot Token.')}
      </GuideNote>

      <GuideStep index={1} title={t('platforms.slack.guide.step1Title', '1️⃣ Create Slack App')} defaultOpen>
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.slack.guide.step1Item1', "Visit <a href=\"https://api.slack.com/apps\" target=\"_blank\" rel=\"noreferrer\">api.slack.com/apps</a> and click 'Create New App'.") }} />
          <li>{t('platforms.slack.guide.step1Item2', "Select 'From scratch', enter App name and select target workspace.")}</li>
          <li>{t('platforms.slack.guide.step1Item3', "Set display name in 'App Home' and ensure 'Messages Tab' is enabled.")}</li>
        </ol>
      </GuideStep>

      <GuideStep index={2} title={t('platforms.slack.guide.step2Title', '2️⃣ Enable Socket Mode')}>
        <ol>
          <li>{t('platforms.slack.guide.step2Item1', "Click 'Socket Mode' in the left menu and turn it on.")}</li>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.slack.guide.step2Item2', 'Generate an App-Level Token as prompted, ensuring it includes the <code>connections:write</code> scope.') }} />
          <li dangerouslySetInnerHTML={{ __html: t('platforms.slack.guide.step2Item3', "Copy the generated <code>xapp-...</code> Token and paste it into the 'App Token' field on the left.") }} />
        </ol>
      </GuideStep>

      <GuideStep index={3} title={t('platforms.slack.guide.step3Title', '3️⃣ Configure Permissions & Events')}>
        <ol>
          <li>{t('platforms.slack.guide.step3Item1', "Add required scopes (e.g., chat:write, im:history) to 'Bot Token Scopes' in 'OAuth & Permissions'.")}</li>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.slack.guide.step3Item2', "Enable events in 'Event Subscriptions' and add <code>message.im</code> and <code>app_mention</code>.") }} />
        </ol>
        <CodeBlock label="Scopes" code={'chat:write\nim:history\napp_mentions:read'} />
      </GuideStep>

      <GuideStep index={4} title={t('platforms.slack.guide.step4Title', '4️⃣ Installation & Integration')}>
        <ol>
          <li>{t('platforms.slack.guide.step4Item1', "Click 'Install to Workspace' and complete authorization.")}</li>
          <li>{t('platforms.slack.guide.step4Item2', "Copy the 'Bot User OAuth Token' (xoxb-...) and paste it into the 'Bot Token' field on the left.")}</li>
          <li>{t('platforms.slack.guide.step4Item3', 'Once saved, your AI assistant will be ready to respond on Slack.')}</li>
        </ol>
        <DocsLink href="https://api.slack.com/docs">{t('platforms.slack.guide.docsLink', 'Official Slack API Documentation')}</DocsLink>
      </GuideStep>
    </GuidePanel>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.slack.header.subtitle', 'Configure Slack Bot credentials and security settings.')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.slack.dialog.deleteTitle', 'Confirm Delete'),
        message: t('platforms.slack.dialog.deleteMessage', 'Are you sure you want to delete this Slack Bot platform? This action cannot be undone.'),
        confirmText: t('platforms.slack.dialog.confirmDelete', 'Delete'),
        cancelText: t('platforms.slack.dialog.cancel', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={guide}
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.slack.form.name', 'Platform Name')}
        placeholder={t('platforms.slack.form.namePlaceholder', 'Enter platform name')}
      />

      <ConfigCard
        icon={KeyRound}
        title={t('platforms.common.sections.credentials', 'Credentials')}
        description={t('platforms.common.sections.credentialsDesc', "Keys from the provider's developer console.")}
      >
        <Field label={t('platforms.slack.form.botToken', 'Bot Token')} htmlFor="slack-bot" hint={t('platforms.slack.form.botTokenHint', "Get the Bot User OAuth Token from the 'OAuth & Permissions' page of your Slack App.")}>
          <SecretInput
            id="slack-bot"
            value={formValues.botToken}
            onChange={(e) => handleChange({ botToken: e.target.value })}
            placeholder={t('platforms.slack.form.botTokenPlaceholder', 'xoxb-...')}
          />
        </Field>
        <Field label={t('platforms.slack.form.appToken', 'App Token (Socket Mode)')} htmlFor="slack-app" hint={t('platforms.slack.form.appTokenHint', "Generate in 'Basic Information' -> 'App-Level Tokens' (requires connections:write scope).")}>
          <SecretInput
            id="slack-app"
            value={formValues.appToken}
            onChange={(e) => handleChange({ appToken: e.target.value })}
            placeholder={t('platforms.slack.form.appTokenPlaceholder', 'xapp-...')}
          />
        </Field>
        <Field label={t('platforms.slack.form.signingSecret', 'Signing Secret (Optional)')} htmlFor="slack-sign" hint={t('platforms.slack.form.signingSecretHint', "Get from 'Basic Information' -> 'App Credentials' to enhance security.")}>
          <SecretInput
            id="slack-sign"
            value={formValues.signingSecret}
            onChange={(e) => handleChange({ signingSecret: e.target.value })}
            placeholder={t('platforms.slack.form.signingSecretPlaceholder', 'Secret for verifying request origin')}
          />
        </Field>
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default SlackPlatformConfig;
