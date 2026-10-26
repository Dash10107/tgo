/**
 * NotificationService - browser notification service
 * 
 * Responsible for:
 * - Checking notification conditions (page visibility, current conversation, message source)
 * - Sending browser desktop notifications
 * - Playing notification sounds
 * - Navigating to the matching conversation when a notification is clicked
 */

import type { Message, Chat } from '@/types';
import { MESSAGE_SENDER_TYPE } from '@/constants';
import { useAuthStore } from '@/stores/authStore';

import i18n from '@/i18n';
/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  /** Whether desktop notifications are enabled */
  notificationEnabled: boolean;
  /** Whether to play a sound */
  notificationSound: boolean;
  /** Notify when the page is not visible */
  notifyOnBackground: boolean;
  /** Notify for messages from other conversations */
  notifyOnOtherConversation: boolean;
  /** Notify for new visitors */
  notifyOnNewVisitor: boolean;
}

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notificationEnabled: true,
  notificationSound: true,
  notifyOnBackground: true,
  notifyOnOtherConversation: true,
  notifyOnNewVisitor: true,
};

/**
 * Notification permission state
 */
export type NotificationPermission = 'default' | 'granted' | 'denied';

/**
 * Notification service class
 */
class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private lastNotificationTime = 0;
  private readonly DEBOUNCE_MS = 1000; // Debounce time: send at most one notification per second
  private readonly NOTIFICATION_DURATION = 5000; // Notification display time: 5 seconds

  constructor() {
    this.initAudio();
  }

  /**
   * Initialize the audio object
   * Try to load the audio file first; if that fails, generate the sound with the Web Audio API
   */
  private initAudio(): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Try to load the audio file
      this.audio = new Audio('/sounds/notification.mp3');
      this.audio.preload = 'auto';
      this.audio.volume = 0.5;
      
      // Listen for load errors and prepare to fall back to the Web Audio API
      this.audio.addEventListener('error', () => {
        console.log('🔔 NotificationService: Audio file not found, will use Web Audio API');
        this.audio = null;
      });
    } catch (error) {
      console.warn('🔔 NotificationService: Failed to initialize audio:', error);
    }
  }

  /**
   * Get or create the AudioContext
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    
    if (!this.audioContext) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
        }
      } catch (error) {
        console.warn('🔔 NotificationService: Web Audio API not supported:', error);
      }
    }
    
    return this.audioContext;
  }

  /**
   * Play a simple notification sound using the Web Audio API
   * Plays two short tones, similar to a common message alert
   */
  private async playWebAudioNotification(): Promise<void> {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      // Make sure the AudioContext is running
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const currentTime = ctx.currentTime;
      
      // Create two short tones
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        
        // Volume fade in/out
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + duration - 0.02);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      // Play two tones: C5 and E5
      playTone(523.25, currentTime, 0.1);       // C5
      playTone(659.25, currentTime + 0.12, 0.15); // E5
      
      console.log('🔔 NotificationService: Web Audio notification played');
    } catch (error) {
      console.warn('🔔 NotificationService: Failed to play Web Audio notification:', error);
    }
  }

  /**
   * Get the current notification permission state
   */
  getPermission(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission as NotificationPermission;
  }

  /**
   * Check whether the browser supports notifications
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      console.warn('🔔 NotificationService: Browser does not support notifications');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('🔔 NotificationService: Permission result:', permission);
      return permission as NotificationPermission;
    } catch (error) {
      console.error('🔔 NotificationService: Failed to request permission:', error);
      return 'denied';
    }
  }

  /**
   * Check whether the page is visible
   */
  private isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }

  /**
   * Check whether the message comes from the currently active conversation
   */
  private isFromActiveChat(message: Message, activeChat: Chat | null): boolean {
    if (!activeChat) return false;
    return message.channelId === activeChat.channelId && 
           message.channelType === activeChat.channelType;
  }

  /**
   * Check whether the message was sent by the user themselves
   */
  private isOwnMessage(message: Message): boolean {
    // Messages of type staff are sent by the user themselves
    const currentUid = useAuthStore.getState().user?.id + "-staff";
    return message.fromUid === currentUid;
  }

  /**
   * Check whether it is a system message
   */
  private isSystemMessage(message: Message): boolean {
    return message.type === MESSAGE_SENDER_TYPE.SYSTEM;
  }

  /**
   * Check whether a notification should be sent
   * 
   * Conditions that trigger a notification (modeled on DingTalk, WeCom and Intercom):
   * 1. A new message is received while the page is not visible
   * 2. The page is visible but the message comes from a non-active conversation
   * 3. The message was not sent by the user themselves
   * 4. System messages do not notify by default
   */
  shouldNotify(
    message: Message,
    activeChat: Chat | null,
    preferences: NotificationPreferences
  ): boolean {
    // 1. Check whether notifications are enabled
    if (!preferences.notificationEnabled) {
      return false;
    }

    // 2. Check whether the message was sent by the user themselves
    if (this.isOwnMessage(message)) {
      return false;
    }

    // 3. System messages do not notify by default
    if (this.isSystemMessage(message)) {
      return false;
    }

    // 4. Check the permission
    if (this.getPermission() !== 'granted') {
      return false;
    }

    const pageVisible = this.isPageVisible();
    const isFromActive = this.isFromActiveChat(message, activeChat);

    // 5. When the page is not visible
    if (!pageVisible && preferences.notifyOnBackground) {
      return true;
    }

    // 6. When the page is visible but the message comes from another conversation
    if (pageVisible && !isFromActive && preferences.notifyOnOtherConversation) {
      return true;
    }

    return false;
  }

  /**
   * Check whether a sound should be played
   */
  shouldPlaySound(
    message: Message,
    activeChat: Chat | null,
    preferences: NotificationPreferences
  ): boolean {
    // The conditions for playing a sound are similar to notifications, but the sound setting is also checked
    if (!preferences.notificationSound) {
      return false;
    }

    // Do not play a sound for the user's own messages
    if (this.isOwnMessage(message)) {
      return false;
    }

    // Do not play a sound for system messages
    if (this.isSystemMessage(message)) {
      return false;
    }

    const pageVisible = this.isPageVisible();
    const isFromActive = this.isFromActiveChat(message, activeChat);

    // Play a sound when the page is not visible
    if (!pageVisible && preferences.notifyOnBackground) {
      return true;
    }

    // Play a sound when the page is visible but the message comes from another conversation
    if (pageVisible && !isFromActive && preferences.notifyOnOtherConversation) {
      return true;
    }

    return false;
  }

  /**
   * Send a desktop notification
   */
  sendDesktopNotification(
    message: Message,
    onClick?: (channelId: string, channelType: number) => void
  ): void {
    if (!this.isSupported() || this.getPermission() !== 'granted') {
      return;
    }

    // Debounce: send at most one notification per second
    const now = Date.now();
    if (now - this.lastNotificationTime < this.DEBOUNCE_MS) {
      console.log('🔔 NotificationService: Debouncing notification');
      return;
    }
    this.lastNotificationTime = now;

    try {
      // Build the notification content
      const senderName = message.fromInfo?.name || i18n.t('visitor.defaultName', 'Visitor');
      const content = this.truncateContent(message.content, 50);
      
      const notification = new Notification(senderName, {
        body: content,
        icon: message.fromInfo?.avatar || '/logo.svg',
        tag: `msg-${message.channelId}`, // Notifications with the same tag are merged
        requireInteraction: false, // Close automatically
        silent: true, // We control the sound ourselves
      });

      // Navigate to the matching conversation when the notification is clicked
      notification.onclick = () => {
        window.focus();
        if (onClick && message.channelId && message.channelType !== undefined) {
          onClick(message.channelId, message.channelType);
        }
        notification.close();
      };

      // Close the notification automatically
      setTimeout(() => {
        notification.close();
      }, this.NOTIFICATION_DURATION);

      console.log('🔔 NotificationService: Notification sent for channel:', message.channelId);
    } catch (error) {
      console.error('🔔 NotificationService: Failed to send notification:', error);
    }
  }

  /**
   * Play the notification sound
   * Prefer the audio file; if that fails, generate the sound with the Web Audio API
   */
  async playNotificationSound(): Promise<void> {
    // Prefer trying the audio file
    if (this.audio) {
      try {
        this.audio.currentTime = 0;
        await this.audio.play();
        console.log('🔔 NotificationService: Sound played (audio file)');
        return;
      } catch (error) {
        // The audio file failed to play; use the Web Audio API
        console.log('🔔 NotificationService: Audio file playback failed, using Web Audio API');
      }
    }

    // Use the Web Audio API as the fallback
    try {
      await this.playWebAudioNotification();
    } catch (error) {
      console.warn('🔔 NotificationService: Failed to play notification sound:', error);
    }
  }

  /**
   * Check and send notifications (unified entry point)
   */
  checkAndNotify(
    message: Message,
    activeChat: Chat | null,
    preferences: NotificationPreferences,
    onNotificationClick?: (channelId: string, channelType: number) => void
  ): void {
    // Check whether a desktop notification should be sent
    if (this.shouldNotify(message, activeChat, preferences)) {
      this.sendDesktopNotification(message, onNotificationClick);
    }

    // Check whether a sound should be played
    if (this.shouldPlaySound(message, activeChat, preferences)) {
      this.playNotificationSound();
    }
  }

  /**
   * Send a test notification
   */
  sendTestNotification(): void {
    if (!this.isSupported() || this.getPermission() !== 'granted') {
      console.warn('🔔 NotificationService: Cannot send test notification - permission not granted');
      return;
    }

    try {
      const notification = new Notification(i18n.t('notification.testTitle', 'Test notification'), {
        body: i18n.t('notification.testBody', 'This is a test notification used to verify that notifications work correctly.'),
        icon: '/logo.svg',
        tag: 'test-notification',
        requireInteraction: false,
      });

      setTimeout(() => {
        notification.close();
      }, this.NOTIFICATION_DURATION);

      // Play the sound
      this.playNotificationSound();

      console.log('🔔 NotificationService: Test notification sent');
    } catch (error) {
      console.error('🔔 NotificationService: Failed to send test notification:', error);
    }
  }

  /**
   * Truncate content
   */
  private truncateContent(content: string, maxLength: number): string {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  /**
   * Update the page title to show the unread count
   */
  updatePageTitle(unreadCount: number, originalTitle?: string): void {
    if (typeof document === 'undefined') return;
    
    const baseTitle = originalTitle || 'Pelatis Customer Service';
    
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }
}

// Export the singleton
export const notificationService = new NotificationService();
