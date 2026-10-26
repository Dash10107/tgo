/**
 * Logout feature test tool
 * Used to verify that logout works correctly
 */

import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';

/**
 * Test the logout feature
 */
export const testLogoutFunctionality = async (): Promise<void> => {
  console.log('🧪 Starting logout test...');

  try {
    // 1. Check the current auth state
    const authState = useAuthStore.getState();
    console.log('🧪 Current auth state:', {
      isAuthenticated: authState.isAuthenticated,
      hasUser: !!authState.user,
      hasToken: !!authState.token
    });

    // 2. Check the chat data
    const chatState = useChatStore.getState();
    console.log('🧪 Current chat data:', {
      chatsCount: chatState.chats.length,
      messagesCount: chatState.messages.length,
      hasActiveChat: !!chatState.activeChat
    });

    // 3. Check local storage
    const localStorageKeys = Object.keys(localStorage);
    const relevantKeys = localStorageKeys.filter(key => 
      key.includes('auth') || 
      key.includes('chat') || 
      key.includes('tgo')
    );
    console.log('🧪 Related local storage keys:', relevantKeys);

    // 4. Perform logout
    console.log('🧪 Performing logout...');
    await authState.logout();

    // Note: because the logout function redirects the page, the code below may not run
    console.log('🧪 Logout complete');

  } catch (error) {
    console.error('🧪 Logout test failed:', error);
  }
};

/**
 * Check the state after logout
 * This function should be called after the page reloads
 */
export const checkLogoutState = (): void => {
  console.log('🧪 Checking state after logout...');

  // 1. Check the auth state
  const authState = useAuthStore.getState();
  console.log('🧪 Auth state after logout:', {
    isAuthenticated: authState.isAuthenticated,
    hasUser: !!authState.user,
    hasToken: !!authState.token
  });

  // 2. Check the chat data
  const chatState = useChatStore.getState();
  console.log('🧪 Chat data after logout:', {
    chatsCount: chatState.chats.length,
    messagesCount: chatState.messages.length,
    hasActiveChat: !!chatState.activeChat
  });

  // 3. Check local storage
  const localStorageKeys = Object.keys(localStorage);
  const relevantKeys = localStorageKeys.filter(key => 
    key.includes('auth') || 
    key.includes('chat') || 
    key.includes('tgo')
  );
  console.log('🧪 Local storage keys after logout:', relevantKeys);

  // 4. Check session storage
  const sessionStorageKeys = Object.keys(sessionStorage);
  console.log('🧪 Session storage keys after logout:', sessionStorageKeys);

  // 5. Verify the result
  const isCleanedProperly = 
    !authState.isAuthenticated &&
    !authState.user &&
    !authState.token &&
    chatState.chats.length === 0 &&
    chatState.messages.length === 0 &&
    !chatState.activeChat &&
    relevantKeys.length === 0 &&
    sessionStorageKeys.length === 0;

  console.log('🧪 Logout cleanup complete:', isCleanedProperly ? '✅ yes' : '❌ no');

  if (!isCleanedProperly) {
    console.warn('🧪 Found data that was not cleaned up:', {
      authNotCleared: authState.isAuthenticated || !!authState.user || !!authState.token,
      chatNotCleared: chatState.chats.length > 0 || chatState.messages.length > 0 || !!chatState.activeChat,
      localStorageNotCleared: relevantKeys.length > 0,
      sessionStorageNotCleared: sessionStorageKeys.length > 0
    });
  }
};

/**
 * Expose the test functions in the browser console
 */
if (typeof window !== 'undefined') {
  (window as any).testLogout = testLogoutFunctionality;
  (window as any).checkLogoutState = checkLogoutState;
  
  console.log('🧪 Logout test tool loaded');
  console.log('🧪 Use testLogout() to test logout');
  console.log('🧪 Use checkLogoutState() to check the state after logout');
}
