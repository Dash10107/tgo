import React, { useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuMessageCircle, LuSparkles, LuLibrary, LuSettings, LuUsers, LuSun, LuMoon } from 'react-icons/lu';
import { DiGoogleCloudPlatform } from "react-icons/di";
import { NAVIGATION_ITEMS } from '@/utils/constants';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import type { NavigationItem } from '@/types';

// Icon mapping for navigation items using react-icons
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageCircle: LuMessageCircle,
  Sparkles: LuSparkles,
  Library: LuLibrary,
  Users: LuUsers,
  Platform: DiGoogleCloudPlatform,
  Settings: LuSettings
};

// Each rail slot is 44px tall with a 10px gap; the active pill slides between slots
const SLOT_SIZE = 44;
const SLOT_GAP = 10;

/** Hover label that slides out to the right of a rail button */
const RailTooltip: React.FC<{ label: string }> = ({ label }) => (
  <span
    role="tooltip"
    className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 -translate-x-1 whitespace-nowrap rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 dark:bg-white dark:text-ink-900"
  >
    {label}
  </span>
);

interface NavItemProps {
  item: NavigationItem;
  isActive: boolean;
}

/**
 * Navigation item component using React Router NavLink
 */
const NavItem: React.FC<NavItemProps> = ({ item, isActive }) => {
  const { t } = useTranslation();
  const IconComponent = ICON_MAP[item.icon];
  const label = t(item.title);

  return (
    <NavLink
      to={item.path}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={`
        group relative z-10 flex items-center justify-center rounded-full transition-colors duration-300
        ${isActive
          ? 'text-white dark:text-ink-900'
          : 'text-gray-500 dark:text-gray-400 hover:bg-white hover:text-ink-900 hover:shadow-sm dark:hover:bg-gray-800 dark:hover:text-white'
        }
      `}
      style={{ width: SLOT_SIZE, height: SLOT_SIZE }}
    >
      {IconComponent && <IconComponent className="h-[19px] w-[19px]" />}
      <RailTooltip label={label} />
    </NavLink>
  );
};

/**
 * Sidebar component: a floating icon rail with a sliding active indicator
 */
const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const isAdmin = user?.role === 'admin';
  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);

  // Filter navigation items based on user role
  // Non-admin users cannot see 'channels' (Platform Integrations) and 'ai' (AI Features)
  const filteredItems = useMemo(() => NAVIGATION_ITEMS.filter(item => {
    if (!isAdmin && (item.id === 'channels' || item.id === 'ai')) {
      return false;
    }
    return true;
  }), [isAdmin]);

  const activeIndex = filteredItems.findIndex(item => location.pathname.startsWith(item.path));

  const isDark = theme === 'dark'
    || (theme === 'system' && typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const themeLabel = isDark
    ? t('shell.theme.light', 'Switch to light mode')
    : t('shell.theme.dark', 'Switch to dark mode');

  const displayName = user?.nickname || user?.username || '';
  const initials = (displayName || 'U').slice(0, 1).toUpperCase();
  const profileLabel = displayName || t('navigation.settings');

  return (
    <aside className="relative z-30 flex w-[76px] shrink-0 flex-col items-center py-5">
      {/* System Logo */}
      <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10">
        <img src="/logo.svg" alt="Logo" className="h-6 w-6 select-none object-contain object-center" />
      </div>

      {/* Navigation */}
      <nav className="relative flex flex-col items-center" style={{ gap: SLOT_GAP }}>
        {/* Sliding active pill */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 rounded-full bg-ink-900 shadow-[0_10px_24px_-10px_rgba(15,16,18,0.7)] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.3,0.64,1)] dark:bg-acid-400 dark:shadow-[0_10px_24px_-10px_rgba(205,238,85,0.5)]"
          style={{
            width: SLOT_SIZE,
            height: SLOT_SIZE,
            opacity: activeIndex >= 0 ? 1 : 0,
            transform: `translate3d(0, ${Math.max(activeIndex, 0) * (SLOT_SIZE + SLOT_GAP)}px, 0)`,
          }}
        />
        {filteredItems.map((item, index) => (
          <NavItem key={item.id} item={item} isActive={index === activeIndex} />
        ))}
      </nav>

      {/* Footer: theme switch + profile */}
      <div className="mt-auto flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={themeLabel}
          className="group relative flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors duration-200 hover:bg-white hover:text-ink-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <span key={isDark ? 'moon' : 'sun'} className="tgo-pop">
            {isDark ? <LuSun className="h-[18px] w-[18px]" /> : <LuMoon className="h-[18px] w-[18px]" />}
          </span>
          <RailTooltip label={themeLabel} />
        </button>

        <button
          type="button"
          onClick={() => navigate('/settings/profile')}
          aria-label={profileLabel}
          className="group relative rounded-full p-[3px] ring-2 ring-acid-400 transition-transform duration-300 hover:scale-105"
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-ink-900 text-sm font-semibold text-white dark:bg-gray-700">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <RailTooltip label={profileLabel} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
