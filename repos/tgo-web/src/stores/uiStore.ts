import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/constants';


type Theme = 'light' | 'dark' | 'system';
type SidebarState = 'expanded' | 'collapsed' | 'hidden';

interface UIState {
  // Theme settings
  theme: Theme;

  // Layout state
  sidebarState: SidebarState;
  chatListCollapsed: boolean;
  visitorPanelCollapsed: boolean;
  aiMenuCollapsed: boolean;

  // Loading state
  globalLoading: boolean;
  loadingMessage: string;

  // Notification state
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: number;
    autoClose?: boolean;
    duration?: number;
  }>;

  // Modal state
  modals: Record<string, {
    isOpen: boolean;
    data?: any;
  }>;

  // Responsive state
  isMobile: boolean;
  isTablet: boolean;
  screenWidth: number;
  screenHeight: number;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // User preferences
  preferences: {
    language: 'en-US' | 'hi-IN' | 'mr-IN' | 'zh-CN';
    fontSize: 'small' | 'medium' | 'large';
    density: 'compact' | 'comfortable' | 'spacious';
    animations: boolean;
    soundEnabled: boolean;
    autoSave: boolean;
    // Notification related settings
    notificationEnabled: boolean;      // Whether desktop notifications are enabled
    notificationSound: boolean;        // Whether to play a sound
    notifyOnBackground: boolean;       // Notify when the page is not visible
    notifyOnOtherConversation: boolean; // Notify for messages from other conversations
    notifyOnNewVisitor: boolean;       // Notify for new visitors
  };

  // Actions
  setTheme: (theme: Theme) => void;
  setSidebarState: (state: SidebarState) => void;
  toggleSidebar: () => void;
  setChatListCollapsed: (collapsed: boolean) => void;
  setVisitorPanelCollapsed: (collapsed: boolean) => void;
  setAIMenuCollapsed: (collapsed: boolean) => void;

  // Loading state
  setGlobalLoading: (loading: boolean, message?: string) => void;

  // Notification management
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Modal management
  openModal: (modalId: string, data?: any) => void;
  closeModal: (modalId: string) => void;
  closeAllModals: () => void;

  // Responsive updates
  updateScreenSize: (width: number, height: number) => void;

  // Connection state updates
  setConnectionStatus: (status: { isConnected: boolean; isConnecting: boolean; error?: string }) => void;

  // User preferences
  updatePreferences: (preferences: Partial<UIState['preferences']>) => void;
  resetPreferences: () => void;
}

const defaultPreferences: UIState['preferences'] = {
  language: 'en-US',
  fontSize: 'medium',
  density: 'comfortable',
  animations: true,
  soundEnabled: true,
  autoSave: true,
  // Default notification settings
  notificationEnabled: true,
  notificationSound: true,
  notifyOnBackground: true,
  notifyOnOtherConversation: true,
  notifyOnNewVisitor: true,
};

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        theme: 'system',
        sidebarState: 'expanded',
        chatListCollapsed: false,
        visitorPanelCollapsed: false,
        aiMenuCollapsed: false,
        globalLoading: false,
        loadingMessage: '',
        notifications: [],
        modals: {},
        isMobile: false,
        isTablet: false,
        screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1920,
        screenHeight: typeof window !== 'undefined' ? window.innerHeight : 1080,
        isConnected: false,
        isConnecting: false,
        connectionError: null,
        preferences: defaultPreferences,

        // Actions
        setTheme: (theme) => {
          set({ theme }, false, 'setTheme');

          // Apply the theme to the DOM
          if (typeof document !== 'undefined') {
            const root = document.documentElement;
            if (theme === 'dark') {
              root.classList.add('dark');
            } else if (theme === 'light') {
              root.classList.remove('dark');
            } else {
              // system theme
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (prefersDark) {
                root.classList.add('dark');
              } else {
                root.classList.remove('dark');
              }
            }
          }
        },

        setSidebarState: (state) => set({ sidebarState: state }, false, 'setSidebarState'),

        toggleSidebar: () => {
          const { sidebarState } = get();
          const newState = sidebarState === 'expanded' ? 'collapsed' : 'expanded';
          set({ sidebarState: newState }, false, 'toggleSidebar');
        },

        setChatListCollapsed: (collapsed) => set({ chatListCollapsed: collapsed }, false, 'setChatListCollapsed'),
        setVisitorPanelCollapsed: (collapsed) => set({ visitorPanelCollapsed: collapsed }, false, 'setVisitorPanelCollapsed'),
        setAIMenuCollapsed: (collapsed) => set({ aiMenuCollapsed: collapsed }, false, 'setAIMenuCollapsed'),

        // Loading state
        setGlobalLoading: (loading, message = '') => set({
          globalLoading: loading,
          loadingMessage: message
        }, false, 'setGlobalLoading'),

        // Notification management
        addNotification: (notification) => {
          const id = Date.now().toString();
          const newNotification = {
            ...notification,
            id,
            timestamp: Date.now(),
            autoClose: notification.autoClose ?? true,
            duration: notification.duration ?? 5000
          };

          set(
            (state) => ({
              notifications: [...state.notifications, newNotification]
            }),
            false,
            'addNotification'
          );

          // Auto-close notifications
          if (newNotification.autoClose) {
            setTimeout(() => {
              get().removeNotification(id);
            }, newNotification.duration);
          }
        },

        removeNotification: (id) => set(
          (state) => ({
            notifications: state.notifications.filter(n => n.id !== id)
          }),
          false,
          'removeNotification'
        ),

        clearNotifications: () => set({ notifications: [] }, false, 'clearNotifications'),

        // Modal management
        openModal: (modalId, data) => set(
          (state) => ({
            modals: {
              ...state.modals,
              [modalId]: { isOpen: true, data }
            }
          }),
          false,
          'openModal'
        ),

        closeModal: (modalId) => set(
          (state) => ({
            modals: {
              ...state.modals,
              [modalId]: { isOpen: false, data: undefined }
            }
          }),
          false,
          'closeModal'
        ),

        closeAllModals: () => set(
          (state) => {
            const closedModals: Record<string, { isOpen: boolean; data?: any }> = {};
            Object.keys(state.modals).forEach(key => {
              closedModals[key] = { isOpen: false, data: undefined };
            });
            return { modals: closedModals };
          },
          false,
          'closeAllModals'
        ),

        // Responsive updates
        updateScreenSize: (width, height) => {
          const isMobile = width < 768;
          const isTablet = width >= 768 && width < 1024;

          set({
            screenWidth: width,
            screenHeight: height,
            isMobile,
            isTablet,
            // Auto-collapse the sidebar on mobile devices
            sidebarState: isMobile ? 'collapsed' : get().sidebarState
          }, false, 'updateScreenSize');
        },

        // Connection state updates
        setConnectionStatus: (status) => set({
          isConnected: status.isConnected,
          isConnecting: status.isConnecting,
          connectionError: status.error || null
        }, false, 'setConnectionStatus'),

        // User preferences
        updatePreferences: (newPreferences) => set(
          (state) => ({
            preferences: { ...state.preferences, ...newPreferences }
          }),
          false,
          'updatePreferences'
        ),

        resetPreferences: () => set({
          preferences: defaultPreferences
        }, false, 'resetPreferences')
      }),
      {
        name: STORAGE_KEYS.UI,
        partialize: (state) => ({
          // Persist user preferences and layout settings
          theme: state.theme,
          sidebarState: state.sidebarState,
          chatListCollapsed: state.chatListCollapsed,
          visitorPanelCollapsed: state.visitorPanelCollapsed,
          aiMenuCollapsed: state.aiMenuCollapsed,
          preferences: state.preferences
        })
      }
    ),
    { name: STORAGE_KEYS.UI }
  )
);

// Initialize responsive listeners
if (typeof window !== 'undefined') {
  const updateSize = () => {
    useUIStore.getState().updateScreenSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener('resize', updateSize);
  updateSize(); // Initialize

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleThemeChange = () => {
    const { theme, setTheme } = useUIStore.getState();
    if (theme === 'system') {
      setTheme('system'); // Trigger re-applying the theme
    }
  };

  mediaQuery.addEventListener('change', handleThemeChange);
}
