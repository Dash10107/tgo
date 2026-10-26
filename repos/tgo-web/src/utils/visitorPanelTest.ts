/**
 * Visitor panel session-switching test tool
 * Used to test the visitor panel's session-switching feature in the browser console
 */

import type { Chat } from '@/types';

/**
 * Create chat data for testing
 */
export const createTestChat = (
  id: string,
  channelType: number,
  channelId?: string,
  visitorId?: string
): Chat => {
  return {
    id,
    platform: channelType === 1 ? 'wechat' : 'group',
    lastMessage: `Test message ${id}`,
    timestamp: new Date().toLocaleTimeString(),
    status: 'active',
    unreadCount: 0,
    channelId: channelId || `channel_${id}`,
    channelType: channelType,
    lastMsgSeq: 1,
    tags: [],
    priority: 'normal',
    metadata: {
      visitor_id: visitorId
    }
  };
};

/**
 * Test the visitor ID extraction logic
 */
export const testVisitorIdExtraction = (): void => {
  console.log('🧪 Testing visitor ID extraction logic...');

  // Test case 1: personal channel, using channelId
  const personalChat = createTestChat('1', 1, 'visitor_123');
  console.log('📋 Personal channel test:', {
    chatId: personalChat.id,
    channelType: personalChat.channelType,
    channelId: personalChat.channelId,
    expectedVisitorId: 'visitor_123'
  });

  // Test case 2: group channel, visitor info should not be shown
  const groupChat = createTestChat('2', 2, 'group_456');
  console.log('📋 Group channel test:', {
    chatId: groupChat.id,
    channelType: groupChat.channelType,
    channelId: groupChat.channelId,
    shouldShowVisitor: false
  });

  // Test case 3: when visitor_id is present
  const chatWithVisitorId = createTestChat('3', 1, 'channel_789', 'visitor_999');
  console.log('📋 Test with visitor_id:', {
    chatId: chatWithVisitorId.id,
    channelType: chatWithVisitorId.channelType,
    channelId: chatWithVisitorId.channelId,
    visitorId: chatWithVisitorId.metadata?.visitor_id,
    expectedVisitorId: 'channel_789' // channelId should take precedence
  });

  console.log('✅ Visitor ID extraction logic test complete');
};

/**
 * Test channel type detection
 */
export const testChannelTypeCheck = (): void => {
  console.log('🧪 Testing channel type detection...');

  const testCases = [
    { channelType: 1, expected: true, description: 'Personal channel' },
    { channelType: 2, expected: false, description: 'Group channel' },
    { channelType: 3, expected: false, description: 'Other channel type' },
    { channelType: undefined, expected: false, description: 'No channel type' }
  ];

  testCases.forEach(({ channelType, expected, description }) => {
    const chat = createTestChat('test', channelType || 0);
    const isPersonal = chat.channelType === 1;
    
    console.log(`📋 ${description}:`, {
      channelType,
      isPersonal,
      expected,
      passed: isPersonal === expected ? '✅' : '❌'
    });
  });

  console.log('✅ Channel type detection test complete');
};

/**
 * Simulate session-switching scenarios
 */
export const simulateSessionSwitching = (): void => {
  console.log('🧪 Simulating session switching scenarios...');

  const scenarios = [
    {
      name: 'Personal channel A → Personal channel B',
      from: createTestChat('A', 1, 'visitor_A'),
      to: createTestChat('B', 1, 'visitor_B'),
      expectedBehavior: 'Should load visitor B info'
    },
    {
      name: 'Personal channel → Group channel',
      from: createTestChat('personal', 1, 'visitor_personal'),
      to: createTestChat('group', 2, 'group_channel'),
      expectedBehavior: 'Should show the group channel notice'
    },
    {
      name: 'Group channel → Personal channel',
      from: createTestChat('group', 2, 'group_channel'),
      to: createTestChat('personal', 1, 'visitor_personal'),
      expectedBehavior: 'Should load the personal visitor info'
    },
    {
      name: 'Switch to the same visitor',
      from: createTestChat('A1', 1, 'same_visitor'),
      to: createTestChat('A2', 1, 'same_visitor'),
      expectedBehavior: 'Should skip the duplicate load'
    }
  ];

  scenarios.forEach(({ name, from, to, expectedBehavior }) => {
    console.log(`📋 Scenario: ${name}`);
    console.log('  From:', {
      id: from.id,
      channelType: from.channelType,
      visitorId: from.channelId
    });
    console.log('  To:', {
      id: to.id,
      channelType: to.channelType,
      visitorId: to.channelId
    });
    console.log('  Expected behavior:', expectedBehavior);
    console.log('');
  });

  console.log('✅ Session switching scenario simulation complete');
};

/**
 * Test the cache mechanism
 */
export const testCacheLogic = (): void => {
  console.log('🧪 Testing cache mechanism...');

  // Simulate cache operations
  const cache = new Map<string, any>();
  const MAX_CACHE_SIZE = 3; // A small cache size makes testing easier

  const addToCache = (visitorId: string, data: any) => {
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        console.log(`🗑️ Removing the oldest cache entry: ${firstKey}`);
        cache.delete(firstKey);
      }
    }
    console.log(`💾 Adding to cache: ${visitorId}`);
    cache.set(visitorId, data);
  };

  // Test adding to the cache
  addToCache('visitor_1', { name: 'Visitor 1' });
  addToCache('visitor_2', { name: 'Visitor 2' });
  addToCache('visitor_3', { name: 'Visitor 3' });
  
  console.log('📋 Current cache state:', Array.from(cache.keys()));
  
  // Test cache overflow
  addToCache('visitor_4', { name: 'Visitor 4' });
  console.log('📋 Cache state after overflow:', Array.from(cache.keys()));

  // Test a cache hit
  const cachedData = cache.get('visitor_2');
  console.log('📋 Cache hit test:', {
    visitorId: 'visitor_2',
    found: !!cachedData,
    data: cachedData
  });

  console.log('✅ Cache mechanism test complete');
};

/**
 * Run all tests
 */
export const runAllVisitorPanelTests = (): void => {
  console.log('🚀 Running visitor panel session-switching tests...');
  console.log('');

  testVisitorIdExtraction();
  console.log('');

  testChannelTypeCheck();
  console.log('');

  simulateSessionSwitching();
  console.log('');

  testCacheLogic();
  console.log('');

  console.log('🎉 All tests complete!');
  console.log('');
  console.log('💡 Usage:');
  console.log('- testVisitorIdExtraction() - test visitor ID extraction logic');
  console.log('- testChannelTypeCheck() - test channel type detection');
  console.log('- simulateSessionSwitching() - simulate session switching scenarios');
  console.log('- testCacheLogic() - test the cache mechanism');
  console.log('- runAllVisitorPanelTests() - run all tests');
};

// Add the test functions to the global object in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).testVisitorIdExtraction = testVisitorIdExtraction;
  (window as any).testChannelTypeCheck = testChannelTypeCheck;
  (window as any).simulateSessionSwitching = simulateSessionSwitching;
  (window as any).testCacheLogic = testCacheLogic;
  (window as any).runAllVisitorPanelTests = runAllVisitorPanelTests;
  
  console.log('🧪 Visitor panel test tool loaded');
  console.log('🧪 Use runAllVisitorPanelTests() to run all tests');
}
