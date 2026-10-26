import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCopy, FiEye, FiEyeOff, FiRefreshCw } from 'react-icons/fi';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import type { Platform, PlatformAIMode } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import { toAbsoluteUrl } from '@/utils/config';

interface Props {
  platform: Platform;
}

const CustomPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const deletePlatform = usePlatformStore(s => s.deletePlatform);
  const enablePlatform = usePlatformStore(s => s.enablePlatform);
  const disablePlatform = usePlatformStore(s => s.disablePlatform);
  const regenerateApiKey = usePlatformStore(s => s.regenerateApiKey);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const platforms = usePlatformStore(s => s.platforms);
  const isUpdating = usePlatformStore(s => s.isUpdating);

  // Name editing
  const [platformName, setPlatformName] = useState<string>(platform.name);
  useEffect(() => { setPlatformName(platform.name); }, [platform.name]);
  const hasNameChanged = useMemo(() => platformName.trim() !== platform.name, [platformName, platform.name]);

  // AI Settings state
  const [aiAgentIds, setAiAgentIds] = useState<string[]>(platform.agent_id ? [platform.agent_id] : []);
  const [aiMode, setAiMode] = useState<PlatformAIMode>(platform.ai_mode ?? 'auto');
  const [fallbackTimeout, setFallbackTimeout] = useState<number | null>(platform.fallback_to_ai_timeout ?? null);

  useEffect(() => {
    setAiAgentIds(platform.agent_id ? [platform.agent_id] : []);
    setAiMode(platform.ai_mode ?? 'auto');
    setFallbackTimeout(platform.fallback_to_ai_timeout ?? null);
  }, [platform.agent_id, platform.ai_mode, platform.fallback_to_ai_timeout]);

  const hasAISettingsChanged = useMemo(() => {
    const origAgentIds = platform.agent_id ? [platform.agent_id] : [];
    const origMode = platform.ai_mode ?? 'auto';
    const origTimeout = platform.fallback_to_ai_timeout ?? null;
    const agentIdsChanged = JSON.stringify(aiAgentIds.sort()) !== JSON.stringify([...origAgentIds].sort());
    const modeChanged = aiMode !== origMode;
    const timeoutChanged = fallbackTimeout !== origTimeout;
    return agentIdsChanged || modeChanged || timeoutChanged;
  }, [aiAgentIds, aiMode, fallbackTimeout, platform.agent_id, platform.ai_mode, platform.fallback_to_ai_timeout]);

  // Callback URL state - initialize from platform.config.callback_url (convert relative to absolute)
  const [callbackUrl, setCallbackUrl] = useState<string>('');
  useEffect(() => {
    const rawUrl = (platform.config as any)?.callback_url ?? '';
    setCallbackUrl(toAbsoluteUrl(rawUrl));
  }, [platform.config]);
  const hasCallbackChanged = useMemo(() => {
    const originalCallback = (platform.config as any)?.callback_url ?? '';
    return callbackUrl.trim() !== originalCallback;
  }, [callbackUrl, platform.config]);

  const canSave = hasNameChanged || hasCallbackChanged || hasAISettingsChanged;

  const [showApiKey, setShowApiKey] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const isEnabled = platform.status === 'connected';
  const apiKey: string = useMemo(() => ((platform.config as any)?.apiKey ?? ''), [platform.config]);
  // Convert relative URLs to absolute URLs for display
  const chatUrl: string = useMemo(() => toAbsoluteUrl(platform.chat_url ?? ''), [platform.chat_url]);

  const copyToClipboard = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(showToast, t('platforms.custom.copied', '{{label}} copied to clipboard', { label }));
    } catch (error) {
      showApiError(showToast, error);
    }
  };

  const handleSave = async () => {
    try {
      // Validate callback URL format if it has changed
      if (hasCallbackChanged && callbackUrl && callbackUrl.trim()) {
        try {
          new URL(callbackUrl);
        } catch {
          showToast('error', t('platforms.custom.invalidUrl', 'Invalid URL format'), t('platforms.custom.invalidUrlHint', 'Please enter a valid HTTP/HTTPS address'));
          return;
        }
      }

      // Build update payload
      const updatePayload: Partial<Platform> = {};

      if (hasNameChanged) {
        updatePayload.name = platformName.trim();
      }

      if (hasCallbackChanged) {
        updatePayload.config = {
          callback_url: callbackUrl.trim() || undefined
        };
      }

      if (hasAISettingsChanged) {
        updatePayload.agent_id = aiAgentIds[0] ?? null;
        updatePayload.ai_mode = aiMode;
        updatePayload.fallback_to_ai_timeout = aiMode === 'assist' ? fallbackTimeout : null;
      }

      await updatePlatform(platform.id, updatePayload);
      showSuccess(showToast, t('platforms.custom.saveSuccess', 'Saved successfully'));
    } catch (error) {
      showApiError(showToast, error);
    }
  };

  const handleToggleStatus = async () => {
    setIsToggling(true);
    try {
      if (isEnabled) {
        await disablePlatform(platform.id);
        showSuccess(showToast, t('platforms.custom.disabled', 'Platform disabled'));
      } else {
        await enablePlatform(platform.id);
        showSuccess(showToast, t('platforms.custom.enabled', 'Platform enabled'));
      }
    } catch (error) {
      showApiError(showToast, error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!confirm(t('platforms.custom.confirmRegenerate', 'Are you sure you want to regenerate the API key? The old key will be invalidated immediately.'))) {
      return;
    }

    setIsRegenerating(true);
    try {
      await regenerateApiKey(platform.id);
      showSuccess(showToast, t('platforms.custom.regenerated', 'API key regenerated successfully'));
    } catch (error) {
      showApiError(showToast, error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const idx = platforms.findIndex(p => p.id === platform.id);
      const nextId = idx !== -1
        ? (idx < platforms.length - 1 ? platforms[idx + 1]?.id : (idx > 0 ? platforms[idx - 1]?.id : null))
        : null;
      await deletePlatform(platform.id);
      showSuccess(showToast, t('platforms.custom.deleted', 'Platform deleted'));
      setConfirmOpen(false);
      if (nextId) navigate(`/platforms/${nextId}`);
      else navigate('/platforms');
    } catch (error) {
      showApiError(showToast, error);
    } finally {
      setIsDeleting(false);
    }
  };

  const displayName = platform.display_name || platform.name;

  return (
    <main className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{displayName} - {t('platforms.custom.title', 'Custom Platform Configuration')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('platforms.custom.subtitle', 'Configure API information and callback URL for third-party program integration.')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={isUpdating || isDeleting}
            onClick={() => setConfirmOpen(true)}
            className={`px-3 py-1.5 text-sm rounded-md ${isDeleting ? 'bg-red-400 text-white' : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600'}`}
          >
            {isDeleting ? t('common.deleting', 'Deleting…') : t('common.delete', 'Delete')}
          </button>
          <button
            disabled={isUpdating || isDeleting || isToggling}
            onClick={handleToggleStatus}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${isEnabled ? 'bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'} ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isToggling ? (isEnabled ? t('common.disabling', 'Disabling…') : t('common.enabling', 'Enabling…')) : (isEnabled ? t('common.disable', 'Disable') : t('common.enable', 'Enable'))}
          </button>
          <button
            disabled={!canSave || isUpdating}
            onClick={handleSave}
            className={`px-3 py-1.5 text-sm rounded-md ${canSave ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
          >
            {isUpdating ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 p-6">
        {/* Left: Configuration Form */}
        <section className="lg:w-2/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 space-y-4 overflow-y-auto min-h-0 auto-hide-scrollbar">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('platforms.custom.configSection', 'Configuration')}</h3>

          {/* Platform Name */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.custom.platformName', 'Platform Name')}</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={t('platforms.custom.platformNamePlaceholder', 'Enter platform name')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('platforms.custom.integration.title', 'API Integration Information')}</h3>

          {/* Chat URL */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.custom.chatUrl', 'Chat API Endpoint')}</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatUrl || t('platforms.custom.notAvailable', 'Not Available')}
                readOnly
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md bg-gray-100/70 dark:bg-gray-700/50 dark:text-gray-200 focus:outline-none font-mono"
              />
              <button
                type="button"
                disabled={!chatUrl}
                onClick={() => copyToClipboard(chatUrl, t('platforms.custom.chatUrl', 'Chat API Endpoint'))}
                className={`px-2 py-1 text-xs rounded-md ${chatUrl ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
              >
                {t('common.copy', 'Copy')}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.custom.chatUrlHint', 'Third-party programs call this address to send conversation messages.')}</p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.custom.apiKey', 'API Key')}</label>
            <div className="flex items-center gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey || t('platforms.custom.notAvailable', 'Not Available')}
                readOnly
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md bg-gray-100/70 dark:bg-gray-700/50 dark:text-gray-200 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                {showApiKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                disabled={!apiKey}
                onClick={() => copyToClipboard(apiKey, t('platforms.custom.apiKey', 'API Key'))}
                className={`px-2 py-1 text-xs rounded-md ${apiKey ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
              >
                <FiCopy className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRegenerateApiKey}
                disabled={isRegenerating}
                className="px-2 py-1 text-xs rounded-md bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 disabled:opacity-50"
              >
                <FiRefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('platforms.custom.apiKeyHint', 'Use X-Platform-API-Key in the request header for authentication.')}</p>
          </div>

          {/* Callback URL */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.custom.callbackUrl', 'Callback URL')}</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('platforms.custom.callbackUrlHint', 'When customer service replies to messages, the system will push messages to this address')}</p>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder={t('platforms.custom.callbackUrlPlaceholder', 'https://your-domain.com/webhook/callback')}
                className="flex-1 text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200 font-mono"
              />
              <button
                type="button"
                disabled={!callbackUrl}
                onClick={() => copyToClipboard(callbackUrl, t('platforms.custom.callbackUrl', 'Callback URL'))}
                className={`px-2 py-1 text-xs rounded-md ${callbackUrl ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
              >
                {t('common.copy', 'Copy')}
              </button>
            </div>
          </div>

          {/* AI Settings */}
          <PlatformAISettings
            platform={platform}
            agentIds={aiAgentIds}
            aiMode={aiMode}
            fallbackTimeout={fallbackTimeout}
            onAgentIdsChange={setAiAgentIds}
            onAIModeChange={setAiMode}
            onFallbackTimeoutChange={setFallbackTimeout}
          />
        </section>

        {/* Right: Integration Guide */}
        <section className="lg:w-3/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 min-h-0 overflow-y-auto auto-hide-scrollbar space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('platforms.custom.integration.guide', 'Integration Guide')}</h3>

          {/* 1. Chat API - Send Messages to Pelatis */}
          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50" open>
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.custom.integration.chatApi', 'Chat API (Send Messages to Pelatis)')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-3 space-y-3">
              {/* API Endpoint */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.endpoint', 'API Endpoint')}</p>
                <code className="block bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs dark:text-gray-300">
                  {chatUrl || '{chat_url}'}
                </code>
              </div>

              {/* Authentication */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.authentication', 'Authentication')}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('platforms.custom.integration.authDesc', 'Add the platform API key in the request header:')}</p>
                <code className="block bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs dark:text-gray-300">
                  X-Platform-API-Key: {apiKey || '{your_api_key}'}
                </code>
              </div>

              {/* Required Parameters */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.requiredParams', 'Required Parameters')}</p>
                <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono dark:text-gray-300">messages</code>: {t('platforms.custom.integration.messagesDesc', 'Array of conversation messages, compatible with OpenAI ChatGPT API format')}</li>
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono dark:text-gray-300">user</code>: {t('platforms.custom.integration.userDesc', 'Unique identifier of the third-party platform user (required)')}</li>
                </ul>
              </div>

              {/* Simple Example */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.simpleExample', 'Simple Example')}</p>
                <code className="block bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs whitespace-pre dark:text-gray-300">
{`POST ${chatUrl || '{chat_url}'}
X-Platform-API-Key: ${apiKey || '{your_api_key}'}
Content-Type: application/json

{
  "messages": [{"role": "user", "content": "Hello"}],
  "user": "third_party_user_123",
  "stream": false
}`}
                </code>
              </div>

              {/* Response Handling */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.responseHandling', 'Response Handling')}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('platforms.custom.integration.responseHandlingDesc', 'After calling the chat API, Pelatis system will return the AI assistant\'s reply. The third-party platform needs to send the returned reply content to the corresponding third-party user. The response format is compatible with OpenAI ChatGPT API, supporting both streaming and non-streaming responses.')}</p>
              </div>
            </div>
          </details>

          {/* 2. Callback API - Receive Customer Service Replies */}
          <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-100">{t('platforms.custom.integration.callbackApi', 'Callback API (Receive Customer Service Replies)')}</summary>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-3 space-y-3">
              {/* Configuration */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.callbackConfig', 'Configure Callback URL')}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('platforms.custom.integration.callbackConfigDesc', 'Configure your callback URL in the \'Callback URL\' field on the left. When customer service replies to a message, the system will send a POST request to that address.')}</p>
              </div>

              {/* Request Format */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.requestFormat', 'Request Format')}</p>
                <code className="block bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs whitespace-pre dark:text-gray-300">
{`POST ${callbackUrl || '{your_callback_url}'}
Content-Type: application/json

{
  "message_id": "msg_123",
  "user": "third_party_user_123",
  "content": "Message content from the support agent",
  "timestamp": "2024-01-01T12:00:00Z"
}`}
                </code>
              </div>

              {/* Field Descriptions */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.fieldDescriptions', 'Field Descriptions')}</p>
                <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono dark:text-gray-300">message_id</code>: {t('platforms.custom.integration.messageIdDesc', 'Unique message identifier')}</li>
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono dark:text-gray-300">user</code>: {t('platforms.custom.integration.callbackUserDesc', 'Third-party user identifier (corresponds to the user field in the chat API)')}</li>
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono dark:text-gray-300">content</code>: {t('platforms.custom.integration.contentDesc', 'Customer service reply message content')}</li>
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono dark:text-gray-300">timestamp</code>: {t('platforms.custom.integration.timestampDesc', 'Message timestamp (ISO 8601 format)')}</li>
                </ul>
              </div>

              {/* Response Requirement */}
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">{t('platforms.custom.integration.responseRequirement', 'Response Requirement')}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('platforms.custom.integration.responseRequirementDesc', 'Please ensure the callback URL is publicly accessible and returns HTTP 200 status code to indicate successful receipt.')}</p>
              </div>
            </div>
          </details>
        </section>
      </div>

      {/* Scoped scrollbar style */}
      <style>{`
        .auto-hide-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.3) transparent; }
        .auto-hide-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .auto-hide-scrollbar::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 4px; }
        .auto-hide-scrollbar:hover::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.35); }
      `}</style>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('platforms.custom.deleteTitle', 'Delete Platform')}
        message={t('platforms.custom.deleteMessage', 'Are you sure you want to delete platform "{{name}}"? This action cannot be undone.', { name: platform.name })}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        isLoading={isDeleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </main>
  );
};

export default CustomPlatformConfig;




