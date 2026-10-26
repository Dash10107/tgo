import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, User, Globe, Palette, LogOut } from 'lucide-react';
import LanguageSelector from '@/components/ui/LanguageSelector';
import { useAuthStore } from '@/stores/authStore';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout, isAuthenticated } = useAuthStore();

  return (
    <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              {t('settings.title', 'Settings')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.subtitle', 'Customize your preferences and application settings')}
            </p>
          </div>
        </div>

        {/* Account Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">
              {t('settings.account.title', 'Account Information')}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-lg">
                  {(user?.nickname || user?.username || 'U').slice(0,1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-base font-medium text-gray-800 dark:text-gray-100">
                {user?.nickname || user?.username || t('auth.notLoggedIn', 'Not logged in')}
              </div>
              {isAuthenticated && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.role === 'agent' ? t('auth.agent', 'Agent') : t('auth.user', 'User')}
                </div>
              )}
            </div>
            {isAuthenticated && (
              <button
                onClick={async () => {
                  try {
                    await logout();
                  } catch (error) {
                    console.error('Logout failed:', error);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t('auth.logout', 'Logout')}
              </button>
            )}
          </div>
        </section>

        {/* Language Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">
              {t('settings.language.title', 'Language Settings')}
            </h2>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('settings.language.description', 'Choose your preferred interface language. Changes will take effect immediately.')}
            </p>
            <div className="flex items-center gap-4">
              <LanguageSelector variant="button" placement="bottom" usePortal={true} />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('settings.language.persistence', 'Language preference will be automatically saved to local storage')}
              </div>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">
              {t('settings.appearance.title', 'Appearance Settings')}
            </h2>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('settings.appearance.comingSoon', 'More appearance and theme options coming soon...')}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;

