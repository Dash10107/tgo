import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Link2, Sparkles, ThumbsUp } from 'lucide-react';
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

interface Props {
  platform: Platform; // expected: platform.type === 'douyin' or 'tiktok'
}

type DouyinConfig = {
  appId: string;
  appSecret: string;
  clientKey: string;
  clientSecret: string;
  callbackUrl: string; // read-only (from backend)
  authScope: string; // comma-separated scopes, e.g., "user_info,video.list"
};

const DouyinPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = useCopyToClipboard();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const savePlatformConfig = usePlatformStore(s => s.savePlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.douyin.messages.platformEnabled', 'Platform Enabled'),
    disabled: t('platforms.douyin.messages.platformDisabled', 'Platform Disabled'),
    deleted: t('platforms.douyin.messages.deleteSuccess', 'Platform Deleted'),
    deletedDetail: t('platforms.douyin.messages.deleteSuccessMessage', 'Platform has been deleted'),
  });
  const name = usePlatformName(platform);
  const ai = usePlatformAISettings(platform);
  const canSave = hasConfigChanges || name.changed || ai.changed;

  // Local form state sourced from platform.config
  const initialFormValues: DouyinConfig = useMemo(() => {
    const cfg = (platform.config || {}) as Record<string, unknown>;
    // callbackUrl: prefer explicit callbackUrl if provided; else fall back to webhookUrl
    const cb = String(cfg.callbackUrl ?? cfg.webhookUrl ?? '');
    // authScope: accept string or array from backend
    const rawScope = cfg.authScope;
    const scope = Array.isArray(rawScope) ? rawScope.join(',') : typeof rawScope === 'string' ? rawScope : '';
    return {
      appId: String(cfg.appId ?? ''),
      appSecret: String(cfg.appSecret ?? ''),
      clientKey: String(cfg.clientKey ?? ''),
      clientSecret: String(cfg.clientSecret ?? ''),
      callbackUrl: cb,
      authScope: scope,
    };
  }, [platform.config]);

  const [formValues, setFormValues] = useState<DouyinConfig>(initialFormValues);
  useEffect(() => { setFormValues(initialFormValues); }, [initialFormValues]);

  const handleChange = (patch: Partial<DouyinConfig>) => {
    const next = { ...formValues, ...patch };
    setFormValues(next);
    const toSave: Partial<PlatformConfig> = {
      appId: next.appId,
      appSecret: next.appSecret,
      clientKey: next.clientKey,
      clientSecret: next.clientSecret,
      authScope: next.authScope,
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
      showSuccess(showToast, t('platforms.douyin.messages.saveSuccess', 'Saved Successfully'), t('platforms.douyin.messages.saveSuccessMessage', 'Douyin platform configuration has been saved'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const scopes = formValues.authScope.split(',').map(s => s.trim()).filter(Boolean);

  const guide = (
    <GuidePanel title={t('platforms.douyin.guide.title', 'Douyin Open Platform Configuration Guide')}>
      <GuideNote icon={Sparkles} title={t('platforms.douyin.guide.overview', 'Quick Overview')}>
        {t('platforms.douyin.guide.overviewText', 'Complete the following four steps: ① Register Open Platform account → ② Create application and get credentials → ③ Configure callback address → ④ Save and test.')}
      </GuideNote>

      <GuideStep index={1} title={t('platforms.douyin.guide.step1Title', '1️⃣ Register Douyin Open Platform Account')} defaultOpen>
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('platforms.douyin.guide.step1Item1', 'Visit <a href="https://developer.open-douyin.com/" target="_blank" rel="noreferrer">Douyin Open Platform</a> and complete account registration and entity authentication (if required).') }} />
          <li>{t('platforms.douyin.guide.step1Item2', 'Log in to the console and complete developer information.')}</li>
        </ol>
      </GuideStep>

      <GuideStep index={2} title={t('platforms.douyin.guide.step2Title', '2️⃣ Create Application and Get Credentials')}>
        <ol>
          <li>{t('platforms.douyin.guide.step2Item1', 'Create a new application in the console and note down the App ID and App Secret.')}</li>
          <li>{t('platforms.douyin.guide.step2Item2', 'Get Client Key and Client Secret in application settings.')}</li>
          <li>{t('platforms.douyin.guide.step2Item3', 'Select and enable the required authorization scope (Scope) according to business needs.')}</li>
        </ol>
        <CodeBlock label=".env" code={'APP_ID=your_app_id\nAPP_SECRET=your_app_secret\nCLIENT_KEY=your_client_key\nCLIENT_SECRET=your_client_secret\nAUTH_SCOPE=user_info,video.list'} />
      </GuideStep>

      <GuideStep index={3} title={t('platforms.douyin.guide.step3Title', '3️⃣ Configure Callback Address')}>
        <ol>
          <li>{t('platforms.douyin.guide.step3Item1', "Configure the callback URL in the Open Platform 'Callback Settings': use the read-only callback URL above.")}</li>
          <li>{t('platforms.douyin.guide.step3Item2', 'Ensure the server is publicly accessible and correctly handles verification requests.')}</li>
        </ol>
        <CodeBlock code="CALLBACK_URL=https://your-domain.com/api/douyin/callback/{platformId}" />
      </GuideStep>

      <GuideStep index={4} title={t('platforms.douyin.guide.step4Title', '4️⃣ Common Issues and Troubleshooting')}>
        <ul>
          <li>{t('platforms.douyin.guide.step4Item1', 'Callback verification failed: Check if the callback URL is accessible and if the TLS certificate is valid.')}</li>
          <li>{t('platforms.douyin.guide.step4Item2', 'Insufficient permissions: Confirm that the required Scope has been enabled and authorized in the Open Platform.')}</li>
          <li>{t('platforms.douyin.guide.step4Item3', 'Credential error: Verify that App ID/Secret and Client Key/Secret are entered correctly.')}</li>
        </ul>
        <DocsLink href="https://developer.open-douyin.com/">{t('platforms.douyin.docsLink', 'Douyin Open Platform documentation')}</DocsLink>
      </GuideStep>

      <GuideNote tone="neutral" icon={ThumbsUp} title={t('platforms.douyin.guide.bestPracticesTitle', 'Best Practices')}>
        <ul>
          <li>{t('platforms.douyin.guide.bestPracticesItem1', 'Store keys in a secure key management service (such as KMS/Vault) to avoid appearing in the code repository.')}</li>
          <li>{t('platforms.douyin.guide.bestPracticesItem2', 'Use different callbacks and credentials for different environments (development/testing/production), with minimum authorization as needed.')}</li>
          <li>{t('platforms.douyin.guide.bestPracticesItem3', 'Regularly rotate keys and minimize permission scope (Scope).')}</li>
        </ul>
      </GuideNote>
    </GuidePanel>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.douyin.subtitle', 'Configure Douyin Open Platform credentials and callback information.')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.douyin.confirm.deleteTitle', 'Delete Platform'),
        message: t('platforms.douyin.confirm.deleteMessage', 'Are you sure you want to delete this platform?'),
        confirmText: t('platforms.douyin.confirm.confirmText', 'Delete'),
        cancelText: t('platforms.douyin.confirm.cancelText', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={guide}
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.douyin.form.platformName', 'Platform Name')}
        placeholder={t('platforms.douyin.form.platformNamePlaceholder', 'Please enter platform name')}
      />

      <ConfigCard
        icon={KeyRound}
        title={t('platforms.common.sections.credentials', 'Credentials')}
        description={t('platforms.common.sections.credentialsDesc', "Keys from the provider's developer console.")}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('platforms.douyin.form.appId', 'App ID')} htmlFor="dy-app">
            <input
              id="dy-app"
              type="text"
              value={formValues.appId}
              onChange={(e) => handleChange({ appId: e.target.value })}
              placeholder={t('platforms.douyin.form.appIdPlaceholder', 'e.g., your_app_id')}
              className="tgo-input font-mono text-[13px]"
            />
          </Field>
          <Field label={t('platforms.douyin.form.appSecret', 'App Secret')} htmlFor="dy-app-secret">
            <SecretInput
              id="dy-app-secret"
              value={formValues.appSecret}
              onChange={(e) => handleChange({ appSecret: e.target.value })}
              placeholder={t('platforms.douyin.form.appSecretPlaceholder', 'Please enter App Secret')}
            />
          </Field>
          <Field label={t('platforms.douyin.form.clientKey', 'Client Key')} htmlFor="dy-client">
            <input
              id="dy-client"
              type="text"
              value={formValues.clientKey}
              onChange={(e) => handleChange({ clientKey: e.target.value })}
              placeholder={t('platforms.douyin.form.clientKeyPlaceholder', 'e.g., your_client_key')}
              className="tgo-input font-mono text-[13px]"
            />
          </Field>
          <Field label={t('platforms.douyin.form.clientSecret', 'Client Secret')} htmlFor="dy-client-secret">
            <SecretInput
              id="dy-client-secret"
              value={formValues.clientSecret}
              onChange={(e) => handleChange({ clientSecret: e.target.value })}
              placeholder={t('platforms.douyin.form.clientSecretPlaceholder', 'Please enter Client Secret')}
            />
          </Field>
        </div>
        <Field label={t('platforms.douyin.form.authScope', 'Authorization Scope')} htmlFor="dy-scope" hint={t('platforms.douyin.form.authScopeHint', 'Separate multiple permissions with commas, e.g., user_info,video.list.')}>
          <input
            id="dy-scope"
            type="text"
            value={formValues.authScope}
            onChange={(e) => handleChange({ authScope: e.target.value })}
            placeholder={t('platforms.douyin.form.authScopePlaceholder', 'e.g., user_info,video.list')}
            className="tgo-input font-mono text-[13px]"
          />
          {scopes.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {scopes.map(scope => (
                <span key={scope} className="tgo-chip font-mono">{scope}</span>
              ))}
            </div>
          )}
        </Field>
      </ConfigCard>

      <ConfigCard
        icon={Link2}
        title={t('platforms.common.sections.callback', 'Webhook')}
        description={t('platforms.common.sections.callbackDesc', 'Messages from the provider arrive at this address.')}
      >
        <Field label={t('platforms.douyin.form.callbackUrl', 'Callback URL')} hint={t('platforms.douyin.form.callbackUrlHint', "Configure this URL in Douyin Open Platform 'Callback Address' settings.")}>
          <CopyField
            value={formValues.callbackUrl}
            placeholder={t('platforms.douyin.form.callbackUrlPlaceholder', 'Callback URL will be generated after platform creation')}
            onCopy={() => copy(formValues.callbackUrl, t('common.copied', 'Copied'))}
          />
        </Field>
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default DouyinPlatformConfig;
