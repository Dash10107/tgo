/**
 * useNotification - notification management hook
 * 
 * Used to:
 * - manage notification permission state
 * - request notification permission
 * - check browser support
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  notificationService, 
  type NotificationPermission,
  type NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES
} from '@/services/notificationService';
import { useUIStore } from '@/stores/uiStore';

export interface UseNotificationReturn {
  /** Notification permission state */
  permission: NotificationPermission;
  /** Whether the browser supports notifications */
  isSupported: boolean;
  /** Whether permission is currently being requested */
  isRequesting: boolean;
  /** Notification preferences */
  preferences: NotificationPreferences;
  /** Request notification permission */
  requestPermission: () => Promise<NotificationPermission>;
  /** Update notification preferences */
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  /** Send a test notification */
  sendTestNotification: () => void;
}

/**
 * Notification management hook
 */
export const useNotification = (): UseNotificationReturn => {
  const [permission, setPermission] = useState<NotificationPermission>(
    notificationService.getPermission()
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const isSupported = notificationService.isSupported();

  // Get notification preferences from uiStore
  const uiPreferences = useUIStore(state => state.preferences);
  const updateUIPreferences = useUIStore(state => state.updatePreferences);

  // Map the uiStore preferences to notification preferences
  const preferences: NotificationPreferences = {
    notificationEnabled: uiPreferences.notificationEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.notificationEnabled,
    notificationSound: uiPreferences.notificationSound ?? DEFAULT_NOTIFICATION_PREFERENCES.notificationSound,
    notifyOnBackground: uiPreferences.notifyOnBackground ?? DEFAULT_NOTIFICATION_PREFERENCES.notifyOnBackground,
    notifyOnOtherConversation: uiPreferences.notifyOnOtherConversation ?? DEFAULT_NOTIFICATION_PREFERENCES.notifyOnOtherConversation,
    notifyOnNewVisitor: uiPreferences.notifyOnNewVisitor ?? DEFAULT_NOTIFICATION_PREFERENCES.notifyOnNewVisitor,
  };

  // Listen for permission changes (supported by some browsers)
  useEffect(() => {
    if (!isSupported) return;

    // Get the initial permission state
    setPermission(notificationService.getPermission());

    // Re-check the permission when page visibility changes
    const handleVisibilityChange = () => {
      setPermission(notificationService.getPermission());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported]);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      return 'denied';
    }

    setIsRequesting(true);
    try {
      const result = await notificationService.requestPermission();
      setPermission(result);
      return result;
    } finally {
      setIsRequesting(false);
    }
  }, [isSupported]);

  /**
   * Update notification preferences
   */
  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    updateUIPreferences(prefs as any);
  }, [updateUIPreferences]);

  /**
   * Send a test notification
   */
  const sendTestNotification = useCallback(() => {
    notificationService.sendTestNotification();
  }, []);

  return {
    permission,
    isSupported,
    isRequesting,
    preferences,
    requestPermission,
    updatePreferences,
    sendTestNotification,
  };
};

export default useNotification;
