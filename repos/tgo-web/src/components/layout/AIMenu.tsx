import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuBot, LuWrench, LuGitBranch, LuSparkles, LuMonitorSmartphone, LuZap } from 'react-icons/lu';
import { AI_MENU_ITEMS } from '@/utils/constants';
import type { NavigationItem } from '@/types';
import OnboardingSidebarPanel from '@/components/onboarding/OnboardingSidebarPanel';

interface AIMenuItemProps {
  item: NavigationItem;
}

// Icon mapping for AI menu items using react-icons
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bot: LuBot,
  Wrench: LuWrench,
  Zap: LuZap,
  GitBranch: LuGitBranch,
  Monitor: LuMonitorSmartphone
};

/**
 * AI menu navigation item component using React Router NavLink
 */
const AIMenuItem: React.FC<AIMenuItemProps> = ({ item }) => {
  const { t } = useTranslation();
  const IconComponent = ICON_MAP[item.icon];

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `
        group flex w-full items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-left text-sm transition-all duration-300
        ${isActive
          ? 'bg-ink-900 text-white shadow-[0_12px_26px_-14px_rgba(15,16,18,0.75)] dark:bg-acid-400 dark:text-ink-900'
          : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
        }
      `}
    >
      {({ isActive }) => (
        <>
          <span className={`
            flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300
            ${isActive
              ? 'bg-acid-400 text-ink-900 dark:bg-ink-900 dark:text-acid-400'
              : 'bg-white text-gray-500 ring-1 ring-gray-200 group-hover:ring-transparent group-hover:bg-gray-100 group-hover:text-gray-800 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:group-hover:bg-gray-700'
            }
          `}>
            {IconComponent && <IconComponent className="h-4 w-4" />}
          </span>
          <span className={`flex-1 truncate ${isActive ? 'font-medium' : ''}`}>{t(item.title)}</span>
          <span className={`h-1.5 w-1.5 rounded-full bg-acid-400 transition-all duration-300 dark:bg-ink-900 ${isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
        </>
      )}
    </NavLink>
  );
};

/**
 * AI feature menu component
 */
const AIMenu: React.FC = () => {
  const { t } = useTranslation();
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200/60 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 pb-6 pt-7">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-acid-400 text-ink-900">
          <LuSparkles className="h-4 w-4" />
        </div>
        <h3 className="tgo-display text-[30px] text-gray-900 dark:text-white">
          {t('ai.menu.title', 'AI Features')}
        </h3>
        <p className="tgo-eyebrow mt-2">{t('ai.menu.subtitle', 'Build & automate')}</p>
      </div>

      {/* Menu Navigation */}
      <nav className="flex-grow space-y-1.5 overflow-y-auto px-3">
        {AI_MENU_ITEMS.map((item) => (
          <AIMenuItem
            key={item.id}
            item={item}
          />
        ))}
      </nav>

      {/* Onboarding Panel */}
      <div className="mt-auto">
        <OnboardingSidebarPanel />
      </div>
    </aside>
  );
};

export default AIMenu;
