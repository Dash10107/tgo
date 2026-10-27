import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Palette, Languages, Check, type LucideIcon } from 'lucide-react';

import LanguageSelector from '@/components/ui/LanguageSelector';
import { useAppSettingsStore, ThemeMode } from '@/stores/appSettingsStore';
import { SettingsPage, SettingsCard } from './SettingsKit';

/** Miniature app window previewing each theme */
const ThemePreview: React.FC<{ mode: ThemeMode }> = ({ mode }) => {
  const light = (
    <div className="flex h-full bg-gray-100">
      <div className="w-1/4 bg-white" />
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-1.5 w-1/2 rounded-full bg-gray-300" />
        <div className="h-6 rounded-md bg-white" />
        <div className="h-1.5 w-1/3 rounded-full bg-acid-400" />
      </div>
    </div>
  );
  const dark = (
    <div className="flex h-full bg-gray-950">
      <div className="w-1/4 bg-gray-900" />
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-1.5 w-1/2 rounded-full bg-gray-700" />
        <div className="h-6 rounded-md bg-gray-800" />
        <div className="h-1.5 w-1/3 rounded-full bg-acid-400" />
      </div>
    </div>
  );

  return (
    <div className="relative h-20 w-full overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgb(15_16_18/0.06)]">
      {mode === 'light' && light}
      {mode === 'dark' && dark}
      {mode === 'system' && (
        <>
          {light}
          <div className="absolute inset-0" style={{ clipPath: 'polygon(55% 0, 100% 0, 100% 100%, 45% 100%)' }}>{dark}</div>
        </>
      )}
    </div>
  );
};

const GeneralSettings: React.FC = () => {
  const { t } = useTranslation();
  const { themeMode, setThemeMode } = useAppSettingsStore();

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: LucideIcon }> = [
    { value: 'light', label: t('settings.theme.light', 'Light'), icon: Sun },
    { value: 'dark', label: t('settings.theme.dark', 'Dark'), icon: Moon },
    { value: 'system', label: t('settings.theme.system', 'Follow System'), icon: Monitor },
  ];

  return (
    <SettingsPage
      title={t('settings.general.title', 'General')}
      subtitle={t('settings.general.subtitle', 'Personalise how the workspace looks and which language it speaks.')}
    >
      <SettingsCard
        icon={Palette}
        iconTone="bg-acid-300 text-ink-900"
        title={t('settings.theme.title', 'Theme Mode')}
        description={t('settings.theme.description', 'Choose your preferred theme mode. Changes will take effect immediately')}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup">
          {themeOptions.map(option => {
            const active = themeMode === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                data-active={active}
                onClick={() => setThemeMode(option.value)}
                className="tgo-option !flex-col !items-stretch !gap-3 !p-3"
              >
                <ThemePreview mode={option.value} />
                <span className="flex items-center justify-between px-1 pb-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    {option.label}
                  </span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full transition-all duration-300 ${active ? 'scale-100 bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'scale-75 bg-gray-100 text-transparent dark:bg-gray-700'}`}>
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Languages}
        title={t('settings.language.title', 'Language Settings')}
        description={t('settings.language.persistence', 'Language preference will be automatically saved to local storage')}
        actions={<LanguageSelector variant="button" placement="bottom" usePortal />}
      />
    </SettingsPage>
  );
};

export default GeneralSettings;
