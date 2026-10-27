import React from 'react';
import { Clock, Compass, Globe2, Languages, Link2, MapPin, MonitorSmartphone, Network, Cpu, CalendarClock } from 'lucide-react';
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
      icon={<MonitorSmartphone size={14} />}
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
        <div className="space-y-2">
          {/* Source page gets a full-width row so long URLs stay readable */}
          <div className="tgo-vtile flex items-start gap-2.5">
            <span className="tgo-vtile-icon"><Link2 size={13} /></span>
            <div className="min-w-0 flex-1">
              <div className="tgo-vtile-label">{t('visitor.system.fields.sourcePage', 'Source Page')}</div>
              {sourceDetailUrl ? (
                <a
                  href={sourceDetailUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tgo-vtile-value block truncate text-acid-800 underline decoration-acid-400 decoration-2 underline-offset-2 hover:text-ink-900 dark:text-acid-300 dark:hover:text-acid-200"
                  title={sourceDetailUrl}
                >
                  {sourceDetailUrl.replace(/^https?:\/\//i, '')}
                </a>
              ) : (
                <div className="tgo-vtile-value truncate" title={sourceDetail}>{sourceDetail}</div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'platform', icon: <Compass size={13} />, label: t('visitor.system.fields.platform', 'Platform'), value: platform },
              { key: 'browser', icon: <Globe2 size={13} />, label: t('visitor.system.fields.browser', 'Browser'), value: browser },
              { key: 'os', icon: <Cpu size={13} />, label: t('visitor.system.fields.os', 'Operating System'), value: os },
              { key: 'language', icon: <Languages size={13} />, label: t('visitor.system.fields.language', 'Language'), value: language },
              { key: 'timezone', icon: <Clock size={13} />, label: t('visitor.system.fields.timezone', 'Timezone'), value: timezone },
              { key: 'location', icon: <MapPin size={13} />, label: t('visitor.system.fields.location', 'Location'), value: displayLocation },
              { key: 'ip', icon: <Network size={13} />, label: t('visitor.system.fields.ipAddress', 'IP Address'), value: ipAddress },
              { key: 'firstSeen', icon: <CalendarClock size={13} />, label: t('visitor.system.fields.firstSeen', 'First Seen'), value: firstSeen },
            ].map((item) => (
              <div key={item.key} className="tgo-vtile min-w-0">
                <div className="mb-1 flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  {item.icon}
                  <span className="tgo-vtile-label truncate">{item.label}</span>
                </div>
                <div className="tgo-vtile-value truncate" title={typeof item.value === 'string' ? item.value : undefined}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 py-6 text-center text-[12px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
          <MonitorSmartphone className="mx-auto mb-2 h-5 w-5 text-gray-300 dark:text-gray-600" />
          {t('visitor.system.empty', 'No system information')}
        </div>
      )}
    </CollapsibleSection>
  );
};

export default SystemInfoSection;
