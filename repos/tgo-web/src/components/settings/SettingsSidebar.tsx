import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Puzzle, User, SlidersHorizontal, Bell, Users, Cpu, Info, LogOut, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import OnboardingSidebarPanel from '@/components/onboarding/OnboardingSidebarPanel';

interface SettingsSidebarProps {
  className?: string;
}

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

/** Settings sections, shared by the desktop sidebar and the mobile pill bar */
export const useSettingsNavItems = (): SettingsNavItem[] => {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');

  const items: SettingsNavItem[] = [
    { id: 'profile', label: t('settings.menu.profile', 'Profile'), icon: User },
    { id: 'general', label: t('settings.menu.general', 'General'), icon: SlidersHorizontal },
    { id: 'notifications', label: t('settings.menu.notifications', 'Notifications'), icon: Bell },
    // Non-admin users cannot see Human Agents, Model Providers and Plugin Management
    { id: 'staff', label: t('settings.menu.staff', 'Human Agents'), icon: Users, adminOnly: true },
    { id: 'providers', label: t('settings.menu.providers', 'Model Providers'), icon: Cpu, adminOnly: true },
    { id: 'plugins', label: t('settings.menu.plugins', 'Plugins'), icon: Puzzle, adminOnly: true },
  ];

  return items.filter(item => isAdmin || !item.adminOnly);
};

const navClass = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-sm transition-all duration-300 ${
    isActive
      ? 'bg-ink-900 font-medium text-white shadow-[0_12px_26px_-14px_rgba(15,16,18,0.75)] dark:bg-acid-400 dark:text-ink-900'
      : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
  }`;

const NavIcon: React.FC<{ icon: LucideIcon; isActive: boolean }> = ({ icon: Icon, isActive }) => (
  <span
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
      isActive
        ? 'bg-acid-400 text-ink-900 dark:bg-ink-900 dark:text-acid-400'
        : 'bg-gray-100 text-gray-500 group-hover:bg-acid-300 group-hover:text-ink-900 dark:bg-gray-800 dark:text-gray-400 dark:group-hover:bg-acid-400'
    }`}
  >
    <Icon className="h-4 w-4" />
  </span>
);

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { logout, isAuthenticated } = useAuthStore();
  const items = useSettingsNavItems();

  return (
    <aside className={`hidden w-64 shrink-0 flex-col border-r border-gray-200/60 bg-gray-50 md:flex dark:border-gray-800 dark:bg-gray-950 ${className}`}>
      <div className="px-6 pb-6 pt-8">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-[0_10px_24px_-12px_rgb(15_16_18/0.7)] dark:bg-acid-400 dark:text-ink-900">
          <SettingsIcon className="h-4 w-4" />
        </div>
        <h2 className="tgo-display text-[32px] text-gray-900 dark:text-white">{t('settings.title', 'Settings')}</h2>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map(item => (
          <NavLink key={item.id} to={`/settings/${item.id}`} className={navClass}>
            {({ isActive }) => (
              <>
                <NavIcon icon={item.icon} isActive={isActive} />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-2 space-y-1 border-t border-gray-200/60 px-3 pb-2 pt-3 dark:border-gray-800">
        <NavLink to="/settings/about" className={navClass}>
          {({ isActive }) => (
            <>
              <NavIcon icon={Info} isActive={isActive} />
              <span>{t('settings.menu.about', 'About')}</span>
            </>
          )}
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
            className="group flex w-full items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 transition-colors group-hover:bg-red-100 dark:bg-red-900/20 dark:group-hover:bg-red-900/40">
              <LogOut className="h-4 w-4" />
            </span>
            <span>{t('settings.menu.logout', 'Logout')}</span>
          </button>
        )}
      </div>

      <OnboardingSidebarPanel />
    </aside>
  );
};

export default SettingsSidebar;
