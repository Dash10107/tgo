import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Volume2, Eye, MessageSquare, Users, ShieldCheck, ShieldX, ShieldQuestion, Send, Lightbulb, BellRing, AlertTriangle } from 'lucide-react';
import { useNotification } from '@/hooks/useNotification';
import Toggle from '@/components/ui/Toggle';
import { InkButton, GhostButton } from '@/components/ui/PageKit';
import { SettingsPage, SettingsCard, SettingsRow, SettingsRows, SettingsNote } from './SettingsKit';

/**
 * Notification settings page
 *
 * - Notification permission status and request button
 * - Desktop / sound toggles
 * - Notification scenario configuration
 * - Test notification
 */
const NotificationSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    permission,
    isSupported,
    isRequesting,
    preferences,
    requestPermission,
    updatePreferences,
    sendTestNotification,
  } = useNotification();

  const permissionConfig = {
    granted: {
      icon: ShieldCheck,
      tone: 'bg-acid-300 text-ink-900',
      chip: 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300',
      label: t('settings.notifications.permission.granted', 'Authorized'),
      description: t('settings.notifications.permission.grantedDesc', 'You can receive desktop notifications'),
    },
    denied: {
      icon: ShieldX,
      tone: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400',
      chip: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400',
      label: t('settings.notifications.permission.denied', 'Denied'),
      description: t('settings.notifications.permission.deniedDesc', 'Please allow notification permission in browser settings'),
    },
    default: {
      icon: ShieldQuestion,
      tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      label: t('settings.notifications.permission.default', 'Not Set'),
      description: t('settings.notifications.permission.defaultDesc', 'Click the button to request notification permission'),
    },
  };

  const currentPermission = permissionConfig[permission] || permissionConfig.default;
  const scenariosDisabled = !preferences.notificationEnabled && !preferences.notificationSound;

  const notificationScenarios = [
    {
      key: 'notifyOnBackground' as const,
      icon: Eye,
      title: t('settings.notifications.scenarios.background.title', 'Background Notifications'),
      description: t('settings.notifications.scenarios.background.description', 'Send notifications when page is not visible (tab switched or minimized)'),
      enabled: preferences.notifyOnBackground,
    },
    {
      key: 'notifyOnOtherConversation' as const,
      icon: MessageSquare,
      title: t('settings.notifications.scenarios.otherConversation.title', 'Other Conversation Messages'),
      description: t('settings.notifications.scenarios.otherConversation.description', 'Send notifications when receiving messages from conversations other than the current one'),
      enabled: preferences.notifyOnOtherConversation,
    },
    {
      key: 'notifyOnNewVisitor' as const,
      icon: Users,
      title: t('settings.notifications.scenarios.newVisitor.title', 'New Visitor Notifications'),
      description: t('settings.notifications.scenarios.newVisitor.description', 'Send notifications when new visitors enter the queue'),
      enabled: preferences.notifyOnNewVisitor,
    },
  ];

  return (
    <SettingsPage
      title={t('settings.notifications.title', 'Notifications')}
      subtitle={t('settings.notifications.subtitle', 'Decide when and how Pelatis taps you on the shoulder.')}
    >
      {!isSupported && (
        <SettingsNote icon={AlertTriangle} tone="warning">
          {t('settings.notifications.notSupported', 'Your browser does not support desktop notifications')}
        </SettingsNote>
      )}

      {/* Permission */}
      <SettingsCard
        icon={currentPermission.icon}
        iconTone={currentPermission.tone}
        title={t('settings.notifications.permission.title', 'Notification Permission')}
        description={currentPermission.description}
        actions={
          <>
            <span className={`tgo-chip h-8 px-3 text-xs ${currentPermission.chip}`}>{currentPermission.label}</span>
            {permission !== 'granted' && isSupported && (
              <InkButton
                onClick={() => { void requestPermission(); }}
                disabled={isRequesting || permission === 'denied'}
                icon={<BellRing className="h-4 w-4" />}
                motion="nudge"
              >
                {isRequesting
                  ? t('settings.notifications.permission.requesting', 'Requesting...')
                  : t('settings.notifications.permission.request', 'Request Permission')}
              </InkButton>
            )}
          </>
        }
      />

      {/* Channels */}
      <SettingsCard title={t('settings.notifications.toggles.title', 'Notification Settings')}>
        <SettingsRows>
          <SettingsRow
            icon={Bell}
            iconTone="bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900"
            label={t('settings.notifications.toggles.desktop.title', 'Desktop Notifications')}
            description={t('settings.notifications.toggles.desktop.description', 'Show notifications in system notification center when new messages arrive')}
            disabled={permission !== 'granted'}
          >
            <Toggle
              checked={preferences.notificationEnabled}
              onChange={(checked) => updatePreferences({ notificationEnabled: checked })}
              disabled={permission !== 'granted'}
              aria-label={t('settings.notifications.toggles.desktop.title', 'Desktop Notifications')}
            />
          </SettingsRow>
          <SettingsRow
            icon={Volume2}
            iconTone="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
            label={t('settings.notifications.toggles.sound.title', 'Sound Alerts')}
            description={t('settings.notifications.toggles.sound.description', 'Play notification sound when new messages arrive')}
          >
            <Toggle
              checked={preferences.notificationSound}
              onChange={(checked) => updatePreferences({ notificationSound: checked })}
              aria-label={t('settings.notifications.toggles.sound.title', 'Sound Alerts')}
            />
          </SettingsRow>
        </SettingsRows>
      </SettingsCard>

      {/* Scenarios */}
      <SettingsCard title={t('settings.notifications.scenarios.title', 'Notification Scenarios')}>
        <SettingsRows>
          {notificationScenarios.map(scenario => (
            <SettingsRow
              key={scenario.key}
              icon={scenario.icon}
              label={scenario.title}
              description={scenario.description}
              disabled={scenariosDisabled}
            >
              <Toggle
                checked={scenario.enabled}
                onChange={(checked) => updatePreferences({ [scenario.key]: checked })}
                disabled={scenariosDisabled}
                aria-label={scenario.title}
              />
            </SettingsRow>
          ))}
        </SettingsRows>
      </SettingsCard>

      {/* Test */}
      <SettingsCard
        icon={Send}
        title={t('settings.notifications.test.title', 'Test Notification')}
        description={t('settings.notifications.test.description', 'Send a test notification to verify the feature is working correctly')}
        actions={
          <GhostButton onClick={sendTestNotification} disabled={permission !== 'granted'}>
            {t('settings.notifications.test.button', 'Send Test')}
          </GhostButton>
        }
      />

      <SettingsNote icon={Lightbulb}>
        {t('settings.notifications.tip', 'Tip: Notification feature requires browser permission. If you denied the permission request, you need to manually allow notifications for this site in your browser settings.')}
      </SettingsNote>
    </SettingsPage>
  );
};

export default NotificationSettings;
