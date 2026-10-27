import React from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, NavLink } from 'react-router-dom';
import { Info } from 'lucide-react';
import SettingsSidebar, { useSettingsNavItems } from '@/components/settings/SettingsSidebar';

const SettingsLayout: React.FC = () => {
  const { t } = useTranslation();
  const items = [
    ...useSettingsNavItems(),
    { id: 'about', label: t('settings.menu.about', 'About'), icon: Info },
  ];

  return (
    <div className="flex h-full w-full flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950">
      <SettingsSidebar />
      <div className="flex-1 overflow-auto">
        {/* Mobile section switcher */}
        <div className="sticky top-0 z-10 border-b border-gray-200/60 bg-gray-50/85 backdrop-blur-lg md:hidden dark:border-gray-800 dark:bg-gray-950/85">
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <NavLink key={item.id} to={`/settings/${item.id}`} className="shrink-0">
                  {({ isActive }) => (
                    <span className="tgo-pill" data-active={isActive}>
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default SettingsLayout;
