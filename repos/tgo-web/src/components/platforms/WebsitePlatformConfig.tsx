import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Code2, Download, ImagePlus, KeyRound, Loader2, Maximize2, Minimize2, Palette, RefreshCw, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ImageCropModal from '@/components/ui/ImageCropModal';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import {
  CodeBlock,
  ConfigCard,
  CopyAction,
  FieldAction,
  GeneralCard,
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
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import platformsApiService from '@/services/platformsApi';
import { keysToSnake } from '@/utils/case';
import { getConfig, getWidgetPreviewUrl } from '@/utils/config';

interface WebsitePlatformConfigProps {
  platform: Platform;
}

type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
type WidgetDisplayMode = 'small' | 'big';

// Keys we will persist in platform.config for website widget
type WebsiteWidgetConfig = {
  widgetTitle: string;
  themeColor: string;
  logoUrl: string;
  welcomeMessage: string;
  position: WidgetPosition;
  displayMode: WidgetDisplayMode;
};

const DEFAULT_THEME_COLOR = '#1E40AF';
const THEME_PRESETS = ['#1E40AF', '#0F1012', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2'];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const POSITIONS: WidgetPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

// Resolve the widget's preview host page (preview.html), which embeds the real SDK
// (launcher + floating panel) instead of stretching the bare widget app over the panel.
// Accepts a widget base like "/widget", "http://localhost:5174" or ".../dist/index.html".
const toWidgetPreviewPage = (base: string): string => {
  const [path, query = ''] = base.split('?');
  const page = /\.html?$/i.test(path)
    ? path.replace(/[^/]*$/, 'preview.html')
    : `${path.replace(/\/+$/, '')}/preview.html`;
  return query ? `${page}?${query}` : page;
};

// Widget preview URL and origin (configurable via runtime config)
const getWidgetPreviewUrlWithFallback = (apiKey?: string, mode?: 'light' | 'dark', lang?: string): string => {
  const url = getWidgetPreviewUrl();
  const baseUrl = toWidgetPreviewPage(url || 'http://127.0.0.1:5500/tgo-widget-js/dist/index.html');

  const params = new URLSearchParams();
  if (apiKey) params.set('apiKey', apiKey);
  if (mode) params.set('mode', mode);
  if (lang) params.set('lang', lang);

  const queryString = params.toString();
  if (queryString) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${queryString}`;
  }
  return baseUrl;
};

const getWidgetPreviewOrigin = (): string => {
  try {
    return new URL(getWidgetPreviewUrlWithFallback(), window.location.origin).origin;
  } catch {
    return '*';
  }
};

// Helper to convert relative URL to absolute using current origin
const toAbsoluteUrl = (url: string): string => {
  if (!url) return url;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Widget SDK script base (configurable via runtime config)
const getWidgetScriptBase = (): string => {
  const configured = getConfig('VITE_WIDGET_SCRIPT_BASE', '');
  if (configured) return toAbsoluteUrl(configured);
  // Fallback to widget preview origin
  return `${getWidgetPreviewOrigin()}/tgo-widget-sdk.js`;
};

const WebsitePlatformConfig: React.FC<WebsitePlatformConfigProps> = ({ platform }) => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const copy = useCopyToClipboard();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore(s => s.resetPlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const fetchPlatformById = usePlatformStore(s => s.fetchPlatformById);
  const regenerateApiKey = usePlatformStore(s => s.regenerateApiKey);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);

  const actions = usePlatformActions(platform, {
    enabled: t('platforms.website.messages.enabled', 'Platform enabled'),
    disabled: t('platforms.website.messages.disabled', 'Platform disabled'),
    deleted: t('platforms.website.messages.deleteSuccess', 'Platform Deleted'),
    deletedDetail: t('platforms.website.messages.deleteSuccessMessage', 'Platform has been deleted'),
  });
  const name = usePlatformName(platform);
  const ai = usePlatformAISettings(platform);
  const canSave = hasConfigChanges || name.changed || ai.changed;

  // Get theme mode from app settings and compute actual mode (light/dark)
  const themeMode = useAppSettingsStore(s => s.themeMode);
  const widgetMode: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode]);

  // Base language code for the widget, e.g. 'zh-CN' -> 'zh'
  const widgetLang = useMemo(() => (i18n.language || 'zh').split('-')[0], [i18n.language]);

  const defaultTitle = t('platforms.website.defaults.widgetTitle', 'Welcome');
  const defaultWelcome = t('platforms.website.defaults.welcomeMessage', 'Hello! How can I help you?');

  const initialFormValues: WebsiteWidgetConfig = useMemo(() => {
    const cfg = (platform.config || {}) as Record<string, unknown>;
    const pick = (camel: string, snake: string): unknown => cfg[camel] ?? cfg[snake];
    return {
      // Read both camelCase (legacy) and snake_case (backend) keys
      widgetTitle: String(pick('widgetTitle', 'widget_title') ?? defaultTitle),
      themeColor: String(pick('themeColor', 'theme_color') ?? DEFAULT_THEME_COLOR),
      // Logo comes from top-level platform.logo_url
      logoUrl: platform.logo_url ?? '',
      welcomeMessage: String(pick('welcomeMessage', 'welcome_message') ?? defaultWelcome),
      position: (cfg.position as WidgetPosition | undefined) ?? 'bottom-right',
      displayMode: (pick('displayMode', 'display_mode') as WidgetDisplayMode | undefined) ?? 'small',
    };
    // Defaults only matter on first read; re-running on language change would discard edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform.config, platform.logo_url]);

  const [formValues, setFormValues] = useState<WebsiteWidgetConfig>(initialFormValues);
  const [hexDraft, setHexDraft] = useState(initialFormValues.themeColor);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const apiKey = String((platform.config as PlatformConfig | undefined)?.apiKey ?? '');

  // Crop modal state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [regenOpen, setRegenOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => { setHexDraft(formValues.themeColor); }, [formValues.themeColor]);

  // Sync logo preview from top-level platform.logo_url changes
  useEffect(() => {
    const url = platform.logo_url || '';
    setFormValues(v => (v.logoUrl !== url ? { ...v, logoUrl: url } : v));
  }, [platform.logo_url]);

  // Live preview: postMessage to widget iframe whenever form changes (after iframe is loaded)
  useEffect(() => {
    if (!previewLoaded) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({
      type: 'CONFIG_UPDATE',
      payload: {
        title: formValues.widgetTitle,
        themeColor: formValues.themeColor,
        logoUrl: formValues.logoUrl,
        welcomeMessage: formValues.welcomeMessage,
        position: formValues.position,
        displayMode: formValues.displayMode,
        lang: widgetLang,
      },
    }, getWidgetPreviewOrigin());
  }, [formValues, previewLoaded, widgetLang]);

  // Ensure platform details (incl. apiKey) are fresh
  useEffect(() => {
    if (!apiKey) {
      fetchPlatformById(platform.id).catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform.id]);

  const previewUrl = getWidgetPreviewUrlWithFallback(apiKey, widgetMode, widgetLang);
  useEffect(() => { setPreviewLoaded(false); }, [previewUrl]);

  const snippet = `<script src="${getWidgetScriptBase()}?api_key=${apiKey}" async></script>`;

  // Generate and download example HTML file with embedded API key
  const handleDownloadExample = useCallback(() => {
    const scriptUrl = getWidgetScriptBase();
    const platformDisplayName = platform.display_name || platform.name || 'Pelatis Widget';

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${platformDisplayName} - ${t('platforms.website.download.demoTitle', 'Widget Demo')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f4f4f5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: #0f1012;
        }
        .container { text-align: center; max-width: 600px; }
        h1 { font-size: 3rem; font-weight: 300; letter-spacing: -0.04em; margin-bottom: 1rem; }
        p { font-size: 1.05rem; color: #52525b; margin-bottom: 2rem; line-height: 1.6; }
        .info-box {
            background: #fff;
            border-radius: 28px;
            padding: 24px;
            margin-top: 2rem;
            text-align: left;
            box-shadow: 0 0 0 1px rgba(15,16,18,0.05), 0 12px 32px -18px rgba(15,16,18,0.25);
        }
        .info-box h3 { font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase; color: #a1a1aa; margin-bottom: 0.75rem; }
        .info-box code {
            display: block;
            background: #0f1012;
            color: #e4e4e7;
            padding: 14px 16px;
            border-radius: 16px;
            font-size: 0.8rem;
            word-break: break-all;
        }
        .warning {
            background: #fffbeb;
            color: #92400e;
            padding: 12px 16px;
            margin-top: 1rem;
            border-radius: 16px;
            font-size: 0.85rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${t('platforms.website.download.welcomeTitle', 'Welcome!')}</h1>
        <p>${t('platforms.website.download.welcomeDesc', 'Your Pelatis chat widget is now integrated! Click the chat button in the bottom-right corner to start a conversation.')}</p>

        <div class="info-box">
            <h3>${t('platforms.website.download.integrationCode', 'Integration Code')}</h3>
            <code>&lt;script src="${scriptUrl}?api_key=${apiKey}" async&gt;&lt;/script&gt;</code>
            <div class="warning">
                ${t('platforms.website.download.securityWarning', 'Security Notice: This file contains your API key. Do not share it publicly or commit it to public repositories.')}
            </div>
        </div>
    </div>

    <!-- Pelatis Widget SDK - Your API Key is pre-configured -->
    <script src="${scriptUrl}?api_key=${apiKey}" async></script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tgo-widget-demo-${platform.id.slice(0, 8)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess(
      showToast,
      t('platforms.website.download.success', 'Download Successful'),
      t('platforms.website.download.successDesc', 'Example file has been downloaded, open it in a browser to see the result')
    );
  }, [apiKey, platform.id, platform.display_name, platform.name, showToast, t]);

  const handleChange = (patch: Partial<WebsiteWidgetConfig>) => {
    setFormValues(v => ({ ...v, ...patch }));
    // Accumulate changes into store for Save
    updatePlatformConfig(platform.id, patch as Partial<PlatformConfig>);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};
      if (hasConfigChanges) {
        // Build full config object from current form state, sent as snake_case
        updates.config = keysToSnake({
          widgetTitle: formValues.widgetTitle.trim(),
          themeColor: formValues.themeColor.trim(),
          welcomeMessage: formValues.welcomeMessage.trim(),
          position: formValues.position,
          displayMode: formValues.displayMode,
        });
      }
      if (name.changed) updates.name = name.name.trim();
      if (ai.changed) Object.assign(updates, ai.updates());

      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
        if (hasConfigChanges) resetPlatformConfig(platform.id);
      }
      showSuccess(showToast, t('platforms.website.messages.saveSuccess', 'Saved Successfully'), t('platforms.website.messages.saveSuccessMessage', 'Platform information has been updated'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showApiError(showToast, new Error(t('platforms.website.errors.fileTooLarge', 'Image size must not exceed 2MB')));
      resetFileInput();
      return;
    }
    if (!file.type.startsWith('image/')) {
      showApiError(showToast, new Error(t('platforms.website.errors.invalidFileType', 'Only image files are supported')));
      resetFileInput();
      return;
    }
    try {
      setCropSrc(URL.createObjectURL(file));
      setPendingFile(file);
      setCropOpen(true);
    } catch (err) {
      showApiError(showToast, err || new Error(t('platforms.website.errors.cropperFailed', 'Unable to open the cropper')));
      resetFileInput();
    }
  };

  const closeCropper = () => {
    setCropOpen(false);
    resetFileInput();
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc('');
    setPendingFile(null);
  };

  const handleCropConfirm = async (blob: Blob, dataUrl: string) => {
    try {
      setUploadingLogo(true);
      // Local preview of the cropped result
      setFormValues(v => ({ ...v, logoUrl: dataUrl }));
      const mime = pendingFile?.type || 'image/png';
      const ext = mime === 'image/jpeg' ? 'jpg' : (mime.split('/')[1] || 'png');
      const croppedFile = new File([blob], `logo-cropped.${ext}`, { type: mime });
      const resp = await platformsApiService.uploadPlatformLogo(platform.id, croppedFile);
      setFormValues(v => ({ ...v, logoUrl: resp.logo_url || dataUrl }));
      await fetchPlatformById(platform.id);
      showSuccess(showToast, t('platforms.website.messages.uploadSuccess', 'Upload Successful'), t('platforms.website.messages.logoUpdated', 'Logo updated'));
    } catch (err) {
      showApiError(showToast, err || new Error(t('platforms.website.errors.uploadFailed', 'Upload failed, please try again')));
    } finally {
      setUploadingLogo(false);
      closeCropper();
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setUploadingLogo(true);
      await platformsApiService.updatePlatform(platform.id, { logo_url: null });
      await fetchPlatformById(platform.id);
      setFormValues(v => ({ ...v, logoUrl: '' }));
      showSuccess(showToast, t('platforms.website.messages.logoRemoved', 'Removed'), t('platforms.website.messages.logoRemovedMessage', 'Logo has been cleared'));
    } catch (err) {
      showApiError(showToast, err || new Error(t('platforms.website.errors.removeLogoFailed', 'Removing the logo is not supported yet; upload a new image to replace it')));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await regenerateApiKey(platform.id);
      showSuccess(showToast, t('platforms.website.messages.updated', 'Updated'), t('platforms.website.messages.apiKeyRegenerated', 'Updated'));
      setRegenOpen(false);
    } catch (e) {
      showApiError(showToast, e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const positionLabel = (position: WidgetPosition): string => {
    switch (position) {
      case 'top-left': return t('platforms.website.form.positionTopLeft', 'Top Left');
      case 'top-right': return t('platforms.website.form.positionTopRight', 'Top Right');
      case 'bottom-left': return t('platforms.website.form.positionBottomLeft', 'Bottom Left');
      default: return t('platforms.website.form.positionBottomRight', 'Bottom Right');
    }
  };

  const preview = (
    <section className="tgo-surface tgo-fade-up p-2">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-acid-400" />
          <span className="tgo-eyebrow ml-3">{t('platforms.website.preview.title', 'Live preview')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-acid-300 px-2.5 py-1 text-[11px] font-semibold text-ink-900">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-900" />
          {t('platforms.website.preview.live', 'Updates as you type')}
        </span>
      </div>
      <div className="relative h-[720px] overflow-hidden rounded-[1.4rem] bg-gray-100 ring-1 ring-black/5 2xl:h-[calc(100vh-8rem)] dark:bg-gray-950 dark:ring-white/5">
        {!previewLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-gray-400">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
            {t('platforms.website.preview.loading', 'Loading preview…')}
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={previewUrl}
          onLoad={() => setPreviewLoaded(true)}
          title="Widget Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-read; clipboard-write"
          className={`relative h-full w-full transition-opacity duration-500 ${previewLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    </section>
  );

  const embed = (
    <ConfigCard
      icon={Code2}
      title={t('platforms.website.embed.title', 'Website Integration Code')}
      description={<span className="tgo-guide" dangerouslySetInnerHTML={{ __html: t('platforms.website.embed.instruction', 'Copy and paste the following code into the <code>&lt;head&gt;</code> or <code>&lt;body&gt;</code> of your website:') }} />}
      className="tgo-fade-up"
    >
      <CodeBlock
        label="HTML"
        code={snippet}
        onCopy={apiKey ? () => copy(snippet, t('platforms.website.messages.embedCodeCopied', 'Copied')) : undefined}
      />
      <div className="flex flex-col gap-4 rounded-3xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.03]">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('platforms.website.download.hint', 'Download a complete integration example file with pre-configured API Key')}
        </p>
        <button type="button" onClick={handleDownloadExample} disabled={!apiKey} className="tgo-btn-ink shrink-0" data-icon-motion="nudge">
          <span className="tgo-btn-icon"><Download className="h-4 w-4" /></span>
          {t('platforms.website.buttons.downloadExample', 'Download Example')}
        </button>
      </div>
    </ConfigCard>
  );

  return (
    <PlatformConfigShell
      platform={platform}
      subtitle={t('platforms.website.header.subtitle', 'Adjust the configuration on the left, the preview on the right will update in real-time')}
      actions={actions}
      deleteDialog={{
        title: t('platforms.website.confirm.deleteTitle', 'Delete Platform'),
        message: t('platforms.website.confirm.deleteMessage', 'Are you sure you want to delete this platform?'),
        confirmText: t('platforms.website.confirm.confirmText', 'Delete'),
        cancelText: t('platforms.website.confirm.cancelText', 'Cancel'),
      }}
      canSave={canSave}
      isSaving={isUpdating}
      onSave={handleSave}
      aside={preview}
      after={embed}
      overlays={
        <>
          <ImageCropModal
            isOpen={cropOpen}
            imageSrc={cropSrc}
            onCancel={closeCropper}
            onConfirm={handleCropConfirm}
          />
          <ConfirmDialog
            isOpen={regenOpen}
            title={t('platforms.website.buttons.regenerate', 'Regenerate')}
            message={t('platforms.website.confirm.regenerateApiKey', 'Are you sure you want to regenerate the API Key? Existing embed scripts will need to be updated.')}
            confirmText={t('platforms.website.buttons.regenerate', 'Regenerate')}
            cancelText={t('common.cancel', 'Cancel')}
            confirmVariant="danger"
            isLoading={isRegenerating}
            onCancel={() => setRegenOpen(false)}
            onConfirm={handleRegenerate}
          />
        </>
      }
    >
      <GeneralCard
        name={name.name}
        onNameChange={name.setName}
        label={t('platforms.website.form.name', 'Name')}
        placeholder={t('platforms.website.form.namePlaceholder', 'Please enter platform name')}
      />

      <ConfigCard
        icon={Palette}
        title={t('platforms.website.form.appearance', 'Appearance')}
        description={t('platforms.website.form.appearanceDesc', 'How the chat widget looks to your visitors.')}
      >
        <Field label={t('platforms.website.form.widgetTitle', 'Visitor Window Title')} htmlFor="ws-title">
          <input
            id="ws-title"
            type="text"
            value={formValues.widgetTitle}
            onChange={e => handleChange({ widgetTitle: e.target.value })}
            className="tgo-input"
          />
        </Field>

        {/* Theme color */}
        <Field label={t('platforms.website.form.themeColor', 'Theme Color')}>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-[inset_0_0_0_2px_rgb(255_255_255/0.6),0_0_0_1px_rgb(15_16_18/0.1)] transition-transform hover:scale-105"
              style={{ backgroundColor: formValues.themeColor }}
              title={t('platforms.website.form.themeColor', 'Theme Color')}
            >
              <input
                type="color"
                value={HEX_COLOR.test(formValues.themeColor) ? formValues.themeColor : DEFAULT_THEME_COLOR}
                onChange={e => handleChange({ themeColor: e.target.value.toUpperCase() })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => {
                const value = e.target.value.trim();
                setHexDraft(value);
                if (HEX_COLOR.test(value)) handleChange({ themeColor: value.toUpperCase() });
              }}
              onBlur={() => setHexDraft(formValues.themeColor)}
              maxLength={7}
              aria-label={t('platforms.website.form.themeColor', 'Theme Color')}
              aria-invalid={!HEX_COLOR.test(hexDraft)}
              className="tgo-input w-32 font-mono text-[13px] uppercase"
            />
            <div className="flex items-center gap-1.5">
              {THEME_PRESETS.map(color => {
                const active = formValues.themeColor.toUpperCase() === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleChange({ themeColor: color })}
                    aria-label={color}
                    title={color}
                    className={`h-7 w-7 rounded-full transition-all duration-200 hover:scale-110 ${active ? 'ring-2 ring-ink-900 ring-offset-2 ring-offset-white dark:ring-acid-400 dark:ring-offset-gray-900' : 'ring-1 ring-black/10'}`}
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>
          </div>
        </Field>

        {/* Logo */}
        <Field label={t('platforms.website.form.logo', 'Logo')} hint={t('platforms.website.form.logoHint', 'Recommended size: 72x72 pixels. Supports PNG/JPG/SVG, max 2MB.')}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              aria-label={t('platforms.website.form.uploadLogo', 'Upload Logo')}
              className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gray-50 shadow-[inset_0_0_0_1.5px_var(--color-gray-200)] transition-all duration-200 hover:shadow-[inset_0_0_0_1.5px_var(--color-acid-500)] dark:bg-gray-800 dark:shadow-[inset_0_0_0_1.5px_var(--color-gray-700)]"
            >
              {formValues.logoUrl ? (
                <img src={formValues.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
              ) : (
                <ImagePlus className="h-6 w-6 text-gray-400 transition-colors group-hover:text-ink-900 dark:group-hover:text-acid-400" />
              )}
              {uploadingLogo && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-900/70">
                  <Loader2 className="h-5 w-5 animate-spin text-ink-900 dark:text-acid-400" />
                </span>
              )}
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="tgo-pill"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {uploadingLogo ? t('platforms.website.form.uploading', 'Uploading…') : t('platforms.website.form.clickUpload', 'Click to Upload')}
              </button>
              {formValues.logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploadingLogo}
                  className="tgo-pill hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('platforms.website.buttons.remove', 'Remove')}
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" disabled={uploadingLogo} onChange={handleFileSelected} className="hidden" />
          </div>
        </Field>

        <Field label={t('platforms.website.form.welcomeMessage', 'Welcome Message')} htmlFor="ws-welcome" aside={`${formValues.welcomeMessage.length}`}>
          <textarea
            id="ws-welcome"
            rows={3}
            value={formValues.welcomeMessage}
            onChange={e => handleChange({ welcomeMessage: e.target.value })}
            className="tgo-input resize-none"
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Position */}
          <Field label={t('platforms.website.form.position', 'Position')}>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {POSITIONS.map(position => {
                const active = formValues.position === position;
                const [vertical, horizontal] = position.split('-');
                return (
                  <button
                    key={position}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-active={active}
                    onClick={() => handleChange({ position })}
                    title={positionLabel(position)}
                    className="tgo-option flex-col !items-stretch !gap-2 !p-2.5"
                  >
                    <span className="relative block h-10 rounded-xl bg-gray-100 dark:bg-gray-700/60">
                      <span
                        className={`absolute h-3 w-3 rounded-full transition-colors ${vertical === 'top' ? 'top-1.5' : 'bottom-1.5'} ${horizontal === 'left' ? 'left-1.5' : 'right-1.5'} ${active ? 'bg-ink-900 dark:bg-acid-400' : 'bg-gray-300 dark:bg-gray-500'}`}
                      />
                    </span>
                    <span className="truncate text-center text-xs font-medium text-gray-700 dark:text-gray-200">{positionLabel(position)}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Display mode */}
          <Field label={t('platforms.website.form.displayMode', 'Default Display Mode')}>
            <div role="radiogroup" className="grid gap-2">
              {(['small', 'big'] as WidgetDisplayMode[]).map(mode => {
                const active = formValues.displayMode === mode;
                const Icon = mode === 'small' ? Minimize2 : Maximize2;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-active={active}
                    onClick={() => handleChange({ displayMode: mode })}
                    className="tgo-option"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${active ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {mode === 'small' ? t('platforms.website.form.displayModeSmall', 'Small Window') : t('platforms.website.form.displayModeBig', 'Big Window')}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </ConfigCard>

      <ConfigCard
        icon={KeyRound}
        title={t('platforms.website.form.apiKey', 'API Key')}
        description={t('platforms.website.form.apiKeyHint', 'Authentication identifier for website integration script, please keep it safe.')}
      >
        <SecretInput
          readOnly
          value={apiKey}
          placeholder={t('platforms.website.form.noApiKey', 'No API Key yet')}
          aria-label={t('platforms.website.form.apiKey', 'API Key')}
          extraActions={[
            <CopyAction
              key="copy"
              disabled={!apiKey}
              onCopy={() => copy(apiKey, t('platforms.website.messages.apiKeyCopied', 'Copied'))}
            />,
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
      </ConfigCard>

      <PlatformAISettings {...ai.props} />
    </PlatformConfigShell>
  );
};

export default WebsitePlatformConfig;
