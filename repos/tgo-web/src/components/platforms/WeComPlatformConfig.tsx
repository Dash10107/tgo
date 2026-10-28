import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, KeyRound, Link2, ShieldCheck, Sparkles, ThumbsUp } from 'lucide-react';
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
  platform: Platform; // expected: platform.type === 'wecom'
}

const readConfig = (platform: Platform) => {
  const cfg = (platform.config || {}) as Record<string, unknown>;
  return {
    corpId: String(cfg.corp_id ?? ''),
    agentId: String(cfg.agent_id ?? ''),
    appSecret: String(cfg.app_secret ?? ''),
    token: String(cfg.token ?? ''),
    encodingAESKey: String(cfg.encoding_aes_key ?? ''),
    // Convert relative callback URL to absolute
    callbackUrl: toAbsoluteUrl(platform.callback_url ?? ''),
  };
};

const WeComPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = useCopyToClipboard();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore(s => s.resetPlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.wecom.messages.enabled', 'Platform enabled'),
    disabled: t('platforms.wecom.messages.disabled', 'Platform disabled'),
    deleted: t('platforms.wecom.messages.deleteSuccess', 'Deleted Successfully'),
    deletedDetail: t('platforms.wecom.messages.deleteSuccessMessage', 'WeCom platform has been deleted'),
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
      corpId: next.corpId,
      agentId: next.agentId,
      appSecret: next.appSecret,
      token: next.token,
      encodingAESKey: next.encodingAESKey,
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (hasConfigChanges) {
        // Transform camelCase form values to snake_case API payload for WeCom
        const aes = formValues.encodingAESKey.trim();
        updates.config = {
          corp_id: formValues.corpId.trim(),
          agent_id: formValues.agentId.trim(),
          app_secret: formValues.appSecret.trim(),
          token: formValues.token.trim(),
          encoding_aes_key: aes || null,
        };
      }
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());
      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
        if (hasConfigChanges) resetPlatformConfig(platform.id);
      }
      showSuccess(showToast, t('platforms.wecom.messages.saveSuccess', 'Saved Successfully'), t('platforms.wecom.messages.saveSuccessMessage', 'WeCom platform configuration has been updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const guide = (
    <GuidePanel title={t('platforms.wecom.guide.title', 'WeCom Configuration Guide')}>
      <GuideNote icon={Sparkles} title={t('platforms.wecom.guide.overview', 'Quick Overview')}>
        {t('platforms.wecom.guide.overviewText', 'Complete these four steps: ① Find CorpID → ② Obtain AgentId/Secret → ③ Configure server callback (URL/Token/EncodingAESKey) → ④ Save and test.')}
      </GuideNote>

      <GuideStep index={1} title={t('platforms.wecom.guide.step1Title', '1️⃣ Find CorpID')} defaultOpen>
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.wecom.guide.step1Item1', 'Log in to the <a href="https://work.weixin.qq.com/wework_admin/frame" target="_blank" rel="noreferrer">WeCom management backend</a>.') }} />
          <li>{t('platforms.wecom.guide.step1Item2', "Go to 'My Company' → 'Company Information'.")}</li>
          <li>{t('platforms.wecom.guide.step1Item3', "Copy the 'CorpID' and paste it into the 'CorpID' field on the left.")}</li>
        </ol>
        <CodeBlock code={t('platforms.wecom.guide.step1Example', 'Example: ww1234567890abcdef')} />
      </GuideStep>

      <GuideStep index={2} title={t('platforms.wecom.guide.step2Title', '2️⃣ Obtain AgentId and App Secret')}>
        <ol>
          <li>{t('platforms.wecom.guide.step2Item1', "Select 'App Management' on the left and open your self-built app.")}</li>
          <li>{t('platforms.wecom.guide.step2Item2', "You can see the 'AgentId' on the app details page.")}</li>
          <li>{t('platforms.wecom.guide.step2Item3', "Click 'Secret' to show or reset, copy and fill into the 'App Secret' field on the left.")}</li>
        </ol>
        <GuideNote tone="warning" icon={ShieldCheck} compact title={t('platforms.wecom.guide.step2SecurityTitle', 'Security Tip')}>
          {t('platforms.wecom.guide.step2SecurityText', 'Keep the Secret safe and do not leak it; use minimum permissions and rotate regularly in production.')}
        </GuideNote>
      </GuideStep>

      <GuideStep index={3} title={t('platforms.wecom.guide.step3Title', '3️⃣ Configure Server Callback (URL / Token / EncodingAESKey)')}>
        <ol>
          <li>{t('platforms.wecom.guide.step3Item1', "In 'App Management' → your app → 'Receive Messages', click 'Set' to enter 'API Receive Messages'.")}</li>
          <li>{t('platforms.wecom.guide.step3Item2', 'URL: Copy the Callback URL (read-only) from the left and paste it into the console;')}</li>
          <li>{t('platforms.wecom.guide.step3Item3', 'Token: Customize any string and ensure it matches the left field;')}</li>
          <li>{t('platforms.wecom.guide.step3Item4', 'EncodingAESKey: Click to generate a 43-character key and copy it to the left field;')}</li>
          <li>{t('platforms.wecom.guide.step3Item5', "Encryption Method: 'Compatible' or 'Safe' mode is recommended.")}</li>
        </ol>
        <CodeBlock
          label={t('platforms.wecom.guide.step3ExampleTitle', 'Example Placeholder (for reference only)')}
          code={'URL:    https://your-domain.com/api/wecom/callback/{platformId}\nToken:  your_token_string\nAESKey: your_43_chars_encoding_aes_key'}
        />
        <GuideNote icon={Info} compact>
          {t('platforms.wecom.guide.step3Note', 'After saving, WeCom will perform URL verification. Ensure your server returns the correct verification response.')}
        </GuideNote>
      </GuideStep>

      <GuideStep index={4} title={t('platforms.wecom.guide.step4Title', '4️⃣ Troubleshooting')}>
        <ul>
          <li>{t('platforms.wecom.guide.step4Item1', 'URL verification failed: Check if your callback service is accessible from the public internet and if the TLS certificate is valid.')}</li>
          <li>{t('platforms.wecom.guide.step4Item2', 'Decryption failed: Confirm the EncodingAESKey is correct and contains no extra spaces.')}</li>
          <li>{t('platforms.wecom.guide.step4Item3', '403/Permission issues: Confirm the app is enabled and granted required permissions; regenerate Secret if necessary.')}</li>
        </ul>
        <DocsLink href="https://developer.work.weixin.qq.com/document/path/90968">{t('platforms.wecom.guide.docsLink', 'WeCom Message Callback Dev Docs')}</DocsLink>
      </GuideStep>

      <GuideNote tone="neutral" icon={ThumbsUp} title={t('platforms.wecom.guide.bestPracticesTitle', 'Best Practices')}>
        <ul>
          <li>{t('platforms.wecom.guide.bestPracticesItem1', 'Store Secrets in a key management service (like Vault, KMS) instead of plaintext in code.')}</li>
          <li>{t('platforms.wecom.guide.bestPracticesItem2', 'Use different Token/AESKey for different environments (Dev/Test/Prod).')}</li>
          <li>{t('platforms.wecom.guide.bestPracticesItem3', 'Rotate Secrets regularly and update server configuration before expiration.')}</li>
        </ul>
      </GuideNote>
    </GuidePanel>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.wecom.header.subtitle', 'Configure credentials and callbacks for WeCom integration.')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.wecom.confirm.deleteTitle', 'Delete Platform'),
        message: t('platforms.wecom.confirm.deleteMessage', 'Are you sure you want to delete this platform?'),
        confirmText: t('platforms.wecom.confirm.confirmText', 'Delete'),
        cancelText: t('platforms.wecom.confirm.cancelText', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={guide}
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.wecom.form.name', 'Platform Name')}
        placeholder={t('platforms.wecom.form.namePlaceholder', 'Please enter platform name')}
      />

      <ConfigCard
        icon={KeyRound}
        title={t('platforms.common.sections.credentials', 'Credentials')}
        description={t('platforms.common.sections.credentialsDesc', "Keys from the provider's developer console.")}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('platforms.wecom.form.corpId', 'CorpID')} htmlFor="wc-corp" hint={t('platforms.wecom.form.corpIdHint', "Can be found in 'My Company' - 'Company Information'.")}>
            <input
              id="wc-corp"
              type="text"
              value={formValues.corpId}
              onChange={(e) => handleChange({ corpId: e.target.value })}
              placeholder={t('platforms.wecom.form.corpIdPlaceholder', 'e.g.: ww1234567890abcdef')}
              className="tgo-input font-mono text-[13px]"
            />
          </Field>
          <Field label={t('platforms.wecom.form.agentId', 'AgentId')} htmlFor="wc-agent" hint={t('platforms.wecom.form.agentIdHint', 'Obtain from the application details page in the WeCom management backend.')}>
            <input
              id="wc-agent"
              type="text"
              value={formValues.agentId}
              onChange={(e) => handleChange({ agentId: e.target.value })}
              placeholder={t('platforms.wecom.form.agentIdPlaceholder', 'e.g.: 1000002')}
              className="tgo-input font-mono text-[13px]"
            />
          </Field>
        </div>
        <Field label={t('platforms.wecom.form.appSecret', 'App Secret')} htmlFor="wc-secret" hint={t('platforms.wecom.form.appSecretHint', 'Used as credentials for calling WeCom interfaces, keep it safe.')}>
          <SecretInput
            id="wc-secret"
            value={formValues.appSecret}
            onChange={(e) => handleChange({ appSecret: e.target.value })}
            placeholder={t('platforms.wecom.form.appSecretPlaceholder', 'Please enter App Secret')}
          />
        </Field>
      </ConfigCard>

      <ConfigCard
        icon={Link2}
        title={t('platforms.common.sections.callback', 'Webhook')}
        description={t('platforms.common.sections.callbackDesc', 'Messages from the provider arrive at this address.')}
      >
        <Field label={t('platforms.wecom.form.callbackUrl', 'Callback URL')} hint={t('platforms.wecom.form.callbackUrlHint', "Set this URL as the callback address in WeCom 'Server Configuration'.")}>
          <CopyField
            value={formValues.callbackUrl}
            placeholder={t('platforms.wecom.form.callbackUrlPlaceholder', 'Callback URL will be generated after creation')}
            onCopy={() => copy(formValues.callbackUrl, t('platforms.wecom.messages.urlCopied', 'Callback URL copied'))}
          />
        </Field>
        <Field label={t('platforms.wecom.form.token', 'Token')} htmlFor="wc-token" hint={t('platforms.wecom.form.tokenHint', 'Must match the Token in the WeCom callback configuration.')}>
          <SecretInput
            id="wc-token"
            value={formValues.token}
            onChange={(e) => handleChange({ token: e.target.value })}
            placeholder={t('platforms.wecom.form.tokenPlaceholder', 'Token for callback verification')}
          />
        </Field>
        <Field label={t('platforms.wecom.form.encodingAESKey', 'EncodingAESKey')} htmlFor="wc-aes" hint={t('platforms.wecom.form.encodingAESKeyHint', 'Used when the message encryption method is compatible/safe mode.')}>
          <SecretInput
            id="wc-aes"
            value={formValues.encodingAESKey}
            onChange={(e) => handleChange({ encodingAESKey: e.target.value })}
            placeholder={t('platforms.wecom.form.encodingAESKeyPlaceholder', '43-character message encryption key')}
          />
        </Field>
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default WeComPlatformConfig;
