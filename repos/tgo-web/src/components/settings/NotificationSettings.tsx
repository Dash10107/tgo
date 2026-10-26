import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Volume2, Eye, MessageSquare, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useNotification } from '@/hooks/useNotification';
import Toggle from '@/components/ui/Toggle';

/**
 * Notification settings page
 * 
 * Features:
 * - Display of notification permission status and a request button
 * - Desktop notification toggle
 * - Sound notification toggle
 * - Notification scenario configuration
 * - Test notification button
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

  // Icon and color for each permission status
  const permissionConfig = {
    granted: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/30',
      borderColor: 'border-green-200 dark:border-green-800',
      label: t('settings.notifications.permission.granted', 'Authorized'),
    },
    denied: {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/30',
      borderColor: 'border-red-200 dark:border-red-800',
      label: t('settings.notifications.permission.denied', 'Denied'),
    },
    default: {
      icon: AlertCircle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      label: t('settings.notifications.permission.default', 'Not Set'),
    },
  };

  const currentPermission = permissionConfig[permission] || permissionConfig.default;
  const PermissionIcon = currentPermission.icon;

  // Handle permission request
  const handleRequestPermission = async () => {
    await requestPermission();
  };

  // Notification scenario settings
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
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">
          {t('settings.notifications.title', 'Notifications')}
        </h2>
      </div>

      {/* Browser not supported notice */}
      {!isSupported && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {t('settings.notifications.notSupported', 'Your browser does not support desktop notifications')}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Permission status */}
        <div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
            {t('settings.notifications.permission.title', 'Notification Permission')}
          </div>
          <div className={`p-4 rounded-lg border ${currentPermission.bgColor} ${currentPermission.borderColor}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PermissionIcon className={`w-5 h-5 ${currentPermission.color}`} />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {currentPermission.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {permission === 'granted'
                      ? t('settings.notifications.permission.grantedDesc', 'You can receive desktop notifications')
                      : permission === 'denied'
                      ? t('settings.notifications.permission.deniedDesc', 'Please allow notification permission in browser settings')
                      : t('settings.notifications.permission.defaultDesc', 'Click the button to request notification permission')}
                  </p>
                </div>
              </div>
              {permission !== 'granted' && isSupported && (
                <button
                  onClick={handleRequestPermission}
                  disabled={isRequesting || permission === 'denied'}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    ${permission === 'denied'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }
                  `}
                >
                  {isRequesting
                    ? t('settings.notifications.permission.requesting', 'Requesting...')
                    : t('settings.notifications.permission.request', 'Request Permission')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notification toggles */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-4">
            {t('settings.notifications.toggles.title', 'Notification Settings')}
          </div>
          <div className="space-y-4">
            {/* Desktop notification toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {t('settings.notifications.toggles.desktop.title', 'Desktop Notifications')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.notifications.toggles.desktop.description', 'Show notifications in system notification center when new messages arrive')}
                  </p>
                </div>
              </div>
              <Toggle
                checked={preferences.notificationEnabled}
                onChange={(checked) => updatePreferences({ notificationEnabled: checked })}
                disabled={permission !== 'granted'}
                aria-label={t('settings.notifications.toggles.desktop.title', 'Desktop Notifications')}
              />
            </div>

            {/* Sound alert toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {t('settings.notifications.toggles.sound.title', 'Sound Alerts')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.notifications.toggles.sound.description', 'Play notification sound when new messages arrive')}
                  </p>
                </div>
              </div>
              <Toggle
                checked={preferences.notificationSound}
                onChange={(checked) => updatePreferences({ notificationSound: checked })}
                aria-label={t('settings.notifications.toggles.sound.title', 'Sound Alerts')}
              />
            </div>
          </div>
        </div>

        {/* Notification scenarios */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-4">
            {t('settings.notifications.scenarios.title', 'Notification Scenarios')}
          </div>
          <div className="space-y-4">
            {notificationScenarios.map((scenario) => {
              const ScenarioIcon = scenario.icon;
              return (
                <div key={scenario.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <ScenarioIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {scenario.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {scenario.description}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={scenario.enabled}
                    onChange={(checked) => updatePreferences({ [scenario.key]: checked })}
                    disabled={!preferences.notificationEnabled && !preferences.notificationSound}
                    aria-label={scenario.title}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Test notification */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t('settings.notifications.test.title', 'Test Notification')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('settings.notifications.test.description', 'Send a test notification to verify the feature is working correctly')}
              </p>
            </div>
            <button
              onClick={sendTestNotification}
              disabled={permission !== 'granted'}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${permission !== 'granted'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }
              `}
            >
              {t('settings.notifications.test.button', 'Send Test')}
            </button>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 {t('settings.notifications.tip', 'Tip: Notification feature requires browser permission. If you denied the permission request, you need to manually allow notifications for this site in your browser settings.')}
        </p>
      </div>
    </div>
  );
};

export default NotificationSettings;
