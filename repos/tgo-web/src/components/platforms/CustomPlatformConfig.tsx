import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Code2, RefreshCw, Webhook } from 'lucide-react';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import {
  CodeBlock,
  ConfigCard,
  CopyAction,
  CopyField,
  FieldAction,
  GeneralCard,
  GuidePanel,
  GuideStep,
  InputWithActions,
  PlatformConfigShell,
  SecretInput,
  useCopyToClipboard,
  usePlatformActions,
  usePlatformAISettings,
  usePlatformName,
} from '@/components/platforms/PlatformKit';
import { Field } from '@/components/ui/ModalKit';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { Platform } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import { toAbsoluteUrl } from '@/utils/config';

interface Props {
  platform: Platform;
}

/** Small heading + body used inside the integration guide steps */
const GuideBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{title}</p>
    {children}
  </div>
);

const CustomPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = useCopyToClipboard();

  const regenerateApiKey = usePlatformStore(s => s.regenerateApiKey);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.custom.enabled', 'Platform enabled'),
    disabled: t('platforms.custom.disabled', 'Platform disabled'),
    deleted: t('platforms.custom.deleted', 'Platform deleted'),
  });
  const name = usePlatformName(platform);
  const ai = usePlatformAISettings(platform);

  const config = (platform.config || {}) as Record<string, unknown>;
  const rawCallback = String(config.callback_url ?? '');

  // Callback URL state - initialize from platform.config.callback_url (convert relative to absolute)
  const [callbackUrl, setCallbackUrl] = useState<string>('');
  useEffect(() => { setCallbackUrl(toAbsoluteUrl(rawCallback)); }, [rawCallback]);
  const hasCallbackChanged = useMemo(() => callbackUrl.trim() !== rawCallback, [callbackUrl, rawCallback]);

  const canSave = name.changed || hasCallbackChanged || ai.changed;

  const [regenOpen, setRegenOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const apiKey = String(config.apiKey ?? '');
  // Convert relative URLs to absolute URLs for display
  const chatUrl = useMemo(() => toAbsoluteUrl(platform.chat_url ?? ''), [platform.chat_url]);

  const copyLabeled = (text: string, label: string) =>
    copy(text, t('platforms.custom.copied', '{{label}} copied to clipboard', { label }));

  const handleSave = async () => {
    try {
      // Validate callback URL format if it has changed
      if (hasCallbackChanged && callbackUrl.trim()) {
        try {
          new URL(callbackUrl);
        } catch {
          showToast('error', t('platforms.custom.invalidUrl', 'Invalid URL format'), t('platforms.custom.invalidUrlHint', 'Please enter a valid HTTP/HTTPS address'));
          return;
        }
      }

      const updatePayload: Partial<Platform> = {};
      if (name.changed) updatePayload.name = name.name.trim();
      if (hasCallbackChanged) updatePayload.config = { callback_url: callbackUrl.trim() || undefined };
      if (ai.changed) Object.assign(updatePayload, ai.updates());

      await updatePlatform(platform.id, updatePayload);
      showSuccess(showToast, t('platforms.custom.saveSuccess', 'Saved successfully'));
    } catch (error) {
      showApiError(showToast, error);
    }
  };

  const handleRegenerateApiKey = async () => {
    setIsRegenerating(true);
    try {
      await regenerateApiKey(platform.id);
      showSuccess(showToast, t('platforms.custom.regenerated', 'API key regenerated successfully'));
      setRegenOpen(false);
    } catch (error) {
      showApiError(showToast, error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const chatExample = `POST ${chatUrl || '{chat_url}'}
X-Platform-API-Key: ${apiKey || '{your_api_key}'}
Content-Type: application/json

{
  "messages": [{"role": "user", "content": "Hello"}],
  "user": "third_party_user_123",
  "stream": false
}`;

  const callbackExample = `POST ${callbackUrl || '{your_callback_url}'}
Content-Type: application/json

{
  "message_id": "msg_123",
  "user": "third_party_user_123",
  "content": "Message content from the support agent",
  "timestamp": "2024-01-01T12:00:00Z"
}`;

  const guide = (
    <GuidePanel icon={Code2} title={t('platforms.custom.integration.guide', 'Integration Guide')}>
      <GuideStep index={1} title={t('platforms.custom.integration.chatApi', 'Chat API (Send Messages to Pelatis)')} defaultOpen>
        <GuideBlock title={t('platforms.custom.integration.endpoint', 'API Endpoint')}>
          <CodeBlock code={chatUrl || '{chat_url}'} />
        </GuideBlock>
        <GuideBlock title={t('platforms.custom.integration.authentication', 'Authentication')}>
          <p>{t('platforms.custom.integration.authDesc', 'Add the platform API key in the request header:')}</p>
          <CodeBlock code={`X-Platform-API-Key: ${apiKey ? `••••••••${apiKey.slice(-4)}` : '{your_api_key}'}`} />
        </GuideBlock>
        <GuideBlock title={t('platforms.custom.integration.requiredParams', 'Required Parameters')}>
          <ul>
            <li><code>messages</code>: {t('platforms.custom.integration.messagesDesc', 'Array of conversation messages, compatible with OpenAI ChatGPT API format')}</li>
            <li><code>user</code>: {t('platforms.custom.integration.userDesc', 'Unique identifier of the third-party platform user (required)')}</li>
          </ul>
        </GuideBlock>
        <GuideBlock title={t('platforms.custom.integration.simpleExample', 'Simple Example')}>
          <CodeBlock label="HTTP" code={chatExample} onCopy={() => copyLabeled(chatExample, t('platforms.custom.integration.simpleExample', 'Simple Example'))} />
        </GuideBlock>
        <GuideBlock title={t('platforms.custom.integration.responseHandling', 'Response Handling')}>
          <p>{t('platforms.custom.integration.responseHandlingDesc', "After calling the chat API, Pelatis system will return the AI assistant's reply. The third-party platform needs to send the returned reply content to the corresponding third-party user. The response format is compatible with OpenAI ChatGPT API, supporting both streaming and non-streaming responses.")}</p>
        </GuideBlock>
      </GuideStep>

      <GuideStep index={2} title={t('platforms.custom.integration.callbackApi', 'Callback API (Receive Customer Service Replies)')}>
        <GuideBlock title={t('platforms.custom.integration.callbackConfig', 'Configure Callback URL')}>
          <p>{t('platforms.custom.integration.callbackConfigDesc', "Configure your callback URL in the 'Callback URL' field on the left. When customer service replies to a message, the system will send a POST request to that address.")}</p>
        </GuideBlock>
        <GuideBlock title={t('platforms.custom.integration.requestFormat', 'Request Format')}>
          <CodeBlock label="HTTP" code={callbackExample} />
        </GuideBlock>
        <GuideBlock title={t('platforms.custom.integration.fieldDescriptions', 'Field Descriptions')}>
          <ul>
            <li><code>message_id</code>: {t('platforms.custom.integration.messageIdDesc', 'Unique message identifier')}</li>
            <li><code>user</code>: {t('platforms.custom.integration.callbackUserDesc', 'Third-party user identifier (corresponds to the user field in the chat API)')}</li>
            <li><code>content</code>: {t('platforms.custom.integration.contentDesc', 'Customer service reply message content')}</li>
            <li><code>timestamp</code>: {t('platforms.custom.integration.timestampDesc', 'Message timestamp (ISO 8601 format)')}</li>
          </ul>
        </GuideBlock>
        <GuideBlock title={t('platforms.custom.integration.responseRequirement', 'Response Requirement')}>
          <p>{t('platforms.custom.integration.responseRequirementDesc', 'Please ensure the callback URL is publicly accessible and returns HTTP 200 status code to indicate successful receipt.')}</p>
        </GuideBlock>
      </GuideStep>
    </GuidePanel>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.custom.subtitle', 'Configure API information and callback URL for third-party program integration.')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.custom.deleteTitle', 'Delete Platform'),
        message: t('platforms.custom.deleteMessage', 'Are you sure you want to delete platform "{{name}}"? This action cannot be undone.', { name: platform.name }),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={guide}
      overlays={
        <ConfirmDialog
          isOpen={regenOpen}
          title={t('platforms.custom.regenerateTitle', 'Regenerate API key?')}
          message={t('platforms.custom.confirmRegenerate', 'Are you sure you want to regenerate the API key? The old key will be invalidated immediately.')}
          confirmText={t('platforms.website.buttons.regenerate', 'Regenerate')}
          cancelText={t('common.cancel', 'Cancel')}
          confirmVariant="danger"
          isLoading={isRegenerating}
          onCancel={() => setRegenOpen(false)}
          onConfirm={handleRegenerateApiKey}
        />
      }
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.custom.platformName', 'Platform Name')}
        placeholder={t('platforms.custom.platformNamePlaceholder', 'Enter platform name')}
      />

      <ConfigCard
        icon={Code2}
        title={t('platforms.custom.integration.title', 'API Integration Information')}
        description={t('platforms.custom.subtitle', 'Configure API information and callback URL for third-party program integration.')}
      >
        <Field label={t('platforms.custom.chatUrl', 'Chat API Endpoint')} hint={t('platforms.custom.chatUrlHint', 'Third-party programs call this address to send conversation messages.')}>
          <CopyField
            value={chatUrl}
            placeholder={t('platforms.custom.notAvailable', 'Not Available')}
            onCopy={() => copyLabeled(chatUrl, t('platforms.custom.chatUrl', 'Chat API Endpoint'))}
          />
        </Field>
        <Field label={t('platforms.custom.apiKey', 'API Key')} hint={t('platforms.custom.apiKeyHint', 'Use X-Platform-API-Key in the request header for authentication.')}>
          <SecretInput
            readOnly
            value={apiKey}
            placeholder={t('platforms.custom.notAvailable', 'Not Available')}
            extraActions={[
              <CopyAction key="copy" disabled={!apiKey} onCopy={() => copyLabeled(apiKey, t('platforms.custom.apiKey', 'API Key'))} />,
              <FieldAction
                key="regen"
                tone="warning"
                onClick={() => setRegenOpen(true)}
                disabled={isRegenerating}
                aria-label={t('platforms.website.buttons.regenerate', 'Regenerate')}
                title={t('platforms.website.buttons.regenerate', 'Regenerate')}
              >
                <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              </FieldAction>,
            ]}
          />
        </Field>
      </ConfigCard>

      <ConfigCard
        icon={Webhook}
        title={t('platforms.custom.callbackUrl', 'Callback URL')}
        description={t('platforms.custom.callbackUrlHint', 'When customer service replies to messages, the system will push messages to this address')}
      >
        <InputWithActions
          type="url"
          mono
          value={callbackUrl}
          onChange={(e) => setCallbackUrl(e.target.value)}
          placeholder={t('platforms.custom.callbackUrlPlaceholder', 'https://your-domain.com/webhook/callback')}
          aria-label={t('platforms.custom.callbackUrl', 'Callback URL')}
          actions={[
            <CopyAction key="copy" disabled={!callbackUrl} onCopy={() => copyLabeled(callbackUrl, t('platforms.custom.callbackUrl', 'Callback URL'))} />,
          ]}
        />
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default CustomPlatformConfig;
