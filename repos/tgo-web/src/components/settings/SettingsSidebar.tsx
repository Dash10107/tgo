import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Puzzle } from 'lucide-react';
import { FiSettings, FiCpu, FiInfo, FiLogOut, FiUsers, FiUser, FiBell } from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';
import OnboardingSidebarPanel from '@/components/onboarding/OnboardingSidebarPanel';

interface SettingsSidebarProps {
  className?: string;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { logout, isAuthenticated, user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const allItems: Array<{ id: string; label: string }> = [
    { id: 'profile', label: t('settings.menu.profile', 'Profile') },
    { id: 'general', label: t('settings.menu.general', 'General') },
    { id: 'notifications', label: t('settings.menu.notifications', 'Notifications') },
    { id: 'staff', label: t('settings.menu.staff', 'Human Agents') },
    { id: 'providers', label: t('settings.menu.providers', 'Model Providers') },
    { id: 'plugins', label: t('settings.menu.plugins', 'Plugins') },
  ];

  // Filter settings items based on user role
  // Non-admin users cannot see 'staff' (Human Agents), 'providers' (Model Providers) and 'plugins' (Plugin Management)
  const items = allItems.filter(item => {
    if (!isAdmin && (item.id === 'staff' || item.id === 'providers' || item.id === 'plugins')) {
      return false;
    }
    return true;
  });

  const iconMap: Record<string, React.ReactNode> = {
    profile: <FiUser className="w-4 h-4" />,
    general: <FiSettings className="w-4 h-4" />,
    notifications: <FiBell className="w-4 h-4" />,
    staff: <FiUsers className="w-4 h-4" />,
    providers: <FiCpu className="w-4 h-4" />,
    plugins: <Puzzle className="w-4 h-4" />,
  };

  return (
    <aside className={`hidden md:flex w-64 flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200/60 dark:border-gray-800 shrink-0 ${className}`}>
      <div className="px-6 pt-7 pb-5">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
          <SettingsIcon className="w-4 h-4" />
        </div>
        <h2 className="tgo-display text-[30px] text-gray-900 dark:text-white">{t('settings.title', 'Settings')}</h2>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={`/settings/${item.id}`}
            className={({ isActive }) => `
              block px-4 py-2.5 rounded-full text-sm transition-all duration-300
              ${isActive ? 'bg-ink-900 text-white font-medium shadow-[0_12px_26px_-14px_rgba(15,16,18,0.75)] dark:bg-acid-400 dark:text-ink-900' : 'text-gray-600 dark:text-gray-400 hover:bg-white hover:text-gray-900 hover:shadow-sm dark:hover:bg-gray-800 dark:hover:text-gray-100'}
            `}
          >
            <span className="inline-flex items-center gap-2">
              {iconMap[item.id]}
              <span>{item.label}</span>
            </span>
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pt-2 pb-1 mt-2 border-t border-gray-200/60 dark:border-gray-800 space-y-1">
        <NavLink
          to="/settings/about"
          className={({ isActive }) => `
            block px-4 py-2.5 rounded-full text-sm transition-all duration-300
            ${isActive ? 'bg-ink-900 text-white font-medium shadow-[0_12px_26px_-14px_rgba(15,16,18,0.75)] dark:bg-acid-400 dark:text-ink-900' : 'text-gray-600 dark:text-gray-400 hover:bg-white hover:text-gray-900 hover:shadow-sm dark:hover:bg-gray-800 dark:hover:text-gray-100'}
          `}
        >
          <span className="inline-flex items-center gap-2">
            <FiInfo className="w-4 h-4" />
            <span>{t('settings.menu.about', 'About')}</span>
          </span>
        </NavLink>
        {isAuthenticated && (
          <button
            onClick={async () => {
              try {
                await logout();
              } catch (error) {
                console.error('Logout failed:', error);
              }
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-full text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <FiLogOut className="w-4 h-4" />
            <span>{t('settings.menu.logout', 'Logout')}</span>
          </button>
        )}
      </div>

      {/* Onboarding Panel */}
      <OnboardingSidebarPanel />
    </aside>
  );
};

export default SettingsSidebar;
