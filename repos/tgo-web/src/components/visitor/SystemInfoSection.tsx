import React from 'react';
import type { SystemInfo as ChannelSystemInfo } from '@/types';
import { useTranslation } from 'react-i18next';
import { formatLocalDateTime } from '@/utils/dateUtils';
import CollapsibleSection from '../ui/CollapsibleSection';

// Mapping of common language codes to display names (English)
const LANGUAGE_DISPLAY_NAMES_EN: Record<string, string> = {
  'zh': 'Chinese',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional, Taiwan)',
  'zh-HK': 'Chinese (Traditional, Hong Kong)',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  'en': 'English',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-AU': 'English (Australia)',
  'ja': 'Japanese',
  'ja-JP': 'Japanese',
  'ko': 'Korean',
  'ko-KR': 'Korean',
  'fr': 'French',
  'fr-FR': 'French',
  'de': 'German',
  'de-DE': 'German',
  'es': 'Spanish',
  'es-ES': 'Spanish',
  'pt': 'Portuguese',
  'pt-BR': 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  'ru': 'Russian',
  'ru-RU': 'Russian',
  'ar': 'Arabic',
  'ar-SA': 'Arabic',
  'th': 'Thai',
  'th-TH': 'Thai',
  'vi': 'Vietnamese',
  'vi-VN': 'Vietnamese',
  'it': 'Italian',
  'it-IT': 'Italian',
  'nl': 'Dutch',
  'nl-NL': 'Dutch',
  'pl': 'Polish',
  'pl-PL': 'Polish',
  'tr': 'Turkish',
  'tr-TR': 'Turkish',
  'id': 'Indonesian',
  'id-ID': 'Indonesian',
  'ms': 'Malay',
  'ms-MY': 'Malay',
};

/**
 * Get the language-name table for the current UI language.
 * Only English has a static table; other UI languages (Hindi, Marathi, ...)
 * fall back to the browser's Intl.DisplayNames in formatLanguageCode.
 */
const getLanguageDisplayNames = (uiLang: string): Record<string, string> => {
  if (uiLang.toLowerCase().startsWith('en')) {
    return LANGUAGE_DISPLAY_NAMES_EN;
  }
  return {};
};

/**
 * Convert a language code to a friendly display name
 * @param code - language code (e.g., 'zh-CN', 'en-US')
 * @param uiLang - current UI language (e.g., 'en', 'hi', 'mr')
 * @returns friendly language name
 */
const formatLanguageCode = (code?: string | null, uiLang: string = 'zh-CN'): string => {
  if (!code || code.trim() === '') return '-';
  
  const trimmedCode = code.trim();
  const displayNames = getLanguageDisplayNames(uiLang);
  
  // Try an exact match first
  if (displayNames[trimmedCode]) {
    return displayNames[trimmedCode];
  }
  
  // Try matching only the language part (e.g. zh-CN matches zh)
  const langPart = trimmedCode.split('-')[0].toLowerCase();
  const matchedKey = Object.keys(displayNames).find(
    key => key.toLowerCase() === langPart
  );
  if (matchedKey) {
    return displayNames[matchedKey];
  }
  
  // If nothing matched, try the browser's built-in Intl.DisplayNames
  try {
    const intlDisplayNames = new Intl.DisplayNames([uiLang], { type: 'language' });
    const displayName = intlDisplayNames.of(trimmedCode);
    if (displayName && displayName !== trimmedCode) {
      return displayName;
    }
  } catch {
    // Intl.DisplayNames does not support this language code
  }
  
  // Finally return the original code
  return trimmedCode;
};

interface SystemInfoSectionProps {
  systemInfo?: ChannelSystemInfo | null;
  language?: string;
  timezone?: string;
  ipAddress?: string;
  displayLocation?: string;
  className?: string;
  draggable?: boolean;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * System info module component
 */
const SystemInfoSection: React.FC<SystemInfoSectionProps> = ({
  systemInfo,
  language: languageProp,
  timezone: timezoneProp,
  ipAddress: ipAddressProp,
  displayLocation: displayLocationProp,
  className = '',
  draggable,
  expanded,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'zh-CN';
  const isUrl = (v?: string | null) => !!v && /^(https?:)\/\//i.test(v.trim());

  const valueOrDash = (v?: string | null) => (v && v.trim() !== '' ? v : '-');

  const platform = valueOrDash(systemInfo?.platform);
  const sourceDetail = valueOrDash(systemInfo?.source_detail);
  const browser = valueOrDash(systemInfo?.browser);
  const os = valueOrDash(systemInfo?.operating_system);
  const firstSeen = formatLocalDateTime(systemInfo?.first_seen_at);
  const language = formatLanguageCode(languageProp, currentLang);
  const timezone = valueOrDash(timezoneProp);
  const ipAddress = valueOrDash(ipAddressProp);
  const displayLocation = valueOrDash(displayLocationProp);

  const sourceDetailRaw = systemInfo?.source_detail ?? null;
  const sourceDetailUrl = typeof sourceDetailRaw === 'string' && isUrl(sourceDetailRaw) ? sourceDetailRaw : null;
  const hasAnyInfo =
    Boolean(systemInfo) ||
    Boolean((languageProp ?? '').trim()) ||
    Boolean((timezoneProp ?? '').trim()) ||
    Boolean((ipAddressProp ?? '').trim()) ||
    Boolean((displayLocationProp ?? '').trim());

  return (
    <CollapsibleSection
      title={t('visitor.sections.systemInfo', 'System Information')}
      className={className}
      defaultExpanded={false}
      expanded={expanded}
      onToggle={onToggle}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {hasAnyInfo ? (
        <div className="space-y-1 px-0.5">
          {[
            { label: t('visitor.system.fields.platform', 'Platform'), value: platform },
            { 
              label: t('visitor.system.fields.sourcePage', 'Source Page'), 
              value: sourceDetailUrl ? (
                <a href={sourceDetailUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline break-all" title={sourceDetailUrl}>
                  {sourceDetailUrl}
                </a>
              ) : sourceDetail 
            },
            { label: t('visitor.system.fields.browser', 'Browser'), value: browser },
            { label: t('visitor.system.fields.os', 'Operating System'), value: os },
            { label: t('visitor.system.fields.language', 'Language'), value: language },
            { label: t('visitor.system.fields.timezone', 'Timezone'), value: timezone },
            { label: t('visitor.system.fields.ipAddress', 'IP Address'), value: ipAddress },
            { label: t('visitor.system.fields.location', 'Location'), value: displayLocation },
            { label: t('visitor.system.fields.firstSeen', 'First Seen'), value: firstSeen },
          ].map((item, idx) => (
            <div key={idx} className="flex justify-between items-start py-0.5 group">
              <span className="text-gray-400 dark:text-gray-500 text-[12px] flex-shrink-0 pt-0.5">{item.label}</span>
              <span className="text-gray-700 dark:text-gray-200 font-medium text-[12px] leading-5 flex-1 min-w-0 ml-4 text-right line-clamp-2 break-all">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-gray-400 dark:text-gray-500 py-4 text-center italic">{t('visitor.system.empty', 'No system information')}</div>
      )}
    </CollapsibleSection>
  );
};

export default SystemInfoSection;
