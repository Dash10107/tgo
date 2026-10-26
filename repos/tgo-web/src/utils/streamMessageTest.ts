/**
 * AI streaming message test tool
 * Used to test and verify incremental updates of streaming messages
 */

import { useChatStore } from '../stores/chatStore';

/**
 * Simulate a streaming message event
 */
export const simulateStreamMessage = (clientMsgNo: string, content: string): void => {
  console.log('🧪 Test: Simulating stream message', {
    clientMsgNo,
    contentLength: content.length,
    contentPreview: content.substring(0, 50)
  });
  
  // Call the chat store method directly
  const store = useChatStore.getState();
  store.appendStreamMessageContent(clientMsgNo, content);
};

/**
 * Simulate a complete AI streaming reply
 */
export const simulateAIStreamResponse = async (
  clientMsgNo: string,
  fullResponse: string,
  chunkSize: number = 10,
  delayMs: number = 100
): Promise<void> => {
  console.log('🧪 Test: Starting AI stream simulation', {
    clientMsgNo,
    fullResponseLength: fullResponse.length,
    chunkSize,
    delayMs,
    estimatedDuration: (fullResponse.length / chunkSize) * delayMs
  });
  
  const store = useChatStore.getState();
  let sentLength = 0;
  
  while (sentLength < fullResponse.length) {
    const chunk = fullResponse.substring(sentLength, sentLength + chunkSize);
    
    console.log('🧪 Test: Sending chunk', {
      chunkNumber: Math.floor(sentLength / chunkSize) + 1,
      chunkLength: chunk.length,
      sentLength,
      totalLength: fullResponse.length,
      progress: `${Math.round((sentLength / fullResponse.length) * 100)}%`
    });
    
    store.appendStreamMessageContent(clientMsgNo, chunk);
    sentLength += chunk.length;
    
    // Wait before sending next chunk
    if (sentLength < fullResponse.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.log('🧪 Test: AI stream simulation completed', {
    clientMsgNo,
    totalSent: sentLength
  });
};

/**
 * Test example: a Markdown-formatted AI reply
 */
export const testMarkdownStreamResponse = async (clientMsgNo: string): Promise<void> => {
  const markdownResponse = `# Solution

Based on your question, I have prepared the following solution:

## 1. Check the configuration

First, make sure your configuration file is set up correctly:

\`\`\`javascript
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};
\`\`\`

## 2. Verify the connection

Use the following command to verify the network connection:

\`\`\`bash
ping api.example.com
curl -I https://api.example.com/health
\`\`\`

## 3. Check the logs

Check the application logs for more information:

- **Error log**: \`/var/log/app/error.log\`
- **Access log**: \`/var/log/app/access.log\`

## 4. Common problems

| Problem | Solution |
|------|---------|
| Connection timeout | Increase the timeout setting |
| Authentication failure | Check the API key |
| Rate limit error | Implement a retry mechanism |

I hope this helps! If you have other questions, feel free to ask.`;

  await simulateAIStreamResponse(clientMsgNo, markdownResponse, 15, 50);
};

/**
 * Check whether a message exists
 */
export const checkMessageExists = (clientMsgNo: string): boolean => {
  const store = useChatStore.getState();
  const message = store.messages.find(
    msg => msg.metadata?.wukongim?.client_msg_no === clientMsgNo
  );
  
  const exists = !!message;
  console.log('🧪 Test: Check message exists', {
    clientMsgNo,
    exists,
    messageId: message?.id,
    contentLength: message?.content.length,
    contentPreview: message?.content.substring(0, 50)
  });
  
  return exists;
};

/**
 * Get the message content
 */
export const getMessageContent = (clientMsgNo: string): string | null => {
  const store = useChatStore.getState();
  const message = store.messages.find(
    msg => msg.metadata?.wukongim?.client_msg_no === clientMsgNo
  );
  
  if (!message) {
    console.warn('🧪 Test: Message not found', { clientMsgNo });
    return null;
  }
  
  console.log('🧪 Test: Get message content', {
    clientMsgNo,
    messageId: message.id,
    contentLength: message.content.length,
    hasStreamData: message.metadata?.has_stream_data,
    isStreaming: message.metadata?.is_streaming
  });
  
  return message.content;
};

/**
 * List all messages
 */
export const listAllMessages = (): void => {
  const store = useChatStore.getState();
  
  console.log('🧪 Test: All messages', {
    totalCount: store.messages.length,
    messages: store.messages.map(msg => ({
      id: msg.id,
      client_msg_no: msg.metadata?.wukongim?.client_msg_no,
      type: msg.type,
      contentLength: msg.content.length,
      contentPreview: msg.content.substring(0, 30),
      hasStreamData: msg.metadata?.has_stream_data,
      isStreaming: msg.metadata?.is_streaming
    }))
  });
};

/**
 * Test whether the stream handler is registered
 */
export const testStreamHandlerRegistration = (): void => {
  console.log('🧪 Test: Checking stream handler registration');
  
  // Try sending a test event
  const testClientMsgNo = 'test-' + Date.now();
  const testContent = 'Test content';
  
  console.log('🧪 Test: Sending test stream message', {
    clientMsgNo: testClientMsgNo,
    content: testContent
  });
  
  // Simulate a streaming message
  simulateStreamMessage(testClientMsgNo, testContent);
  
  // Check whether it was handled
  setTimeout(() => {
    const exists = checkMessageExists(testClientMsgNo);
    if (exists) {
      console.log('✅ Test: Stream handler is working correctly');
    } else {
      console.warn('⚠️ Test: Stream handler may not be registered or message not found');
    }
  }, 100);
};

/**
 * Run the full streaming message test suite
 */
export const runStreamMessageTests = async (): Promise<void> => {
  console.log('🧪 ========================================');
  console.log('🧪 AI streaming message test suite');
  console.log('🧪 ========================================');
  console.log('');
  
  // Test 1: list the current messages
  console.log('📋 Test 1: list current messages');
  listAllMessages();
  console.log('');
  
  // Test 2: check stream handler registration
  console.log('📋 Test 2: check stream handler registration');
  testStreamHandlerRegistration();
  console.log('');
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 3: find an existing message to test with
  const store = useChatStore.getState();
  const testMessage = store.messages.find(msg => 
    msg.metadata?.wukongim?.client_msg_no
  );
  
  if (testMessage) {
    const clientMsgNo = testMessage.metadata!.wukongim!.client_msg_no;
    
    console.log('📋 Test 3: append content to an existing message');
    console.log('   Using message:', {
      id: testMessage.id,
      client_msg_no: clientMsgNo,
      originalContent: testMessage.content.substring(0, 50)
    });
    
    // Append some test content
    simulateStreamMessage(clientMsgNo, '\n\n[Test appended content]');
    
    // Check the result
    setTimeout(() => {
      const updatedContent = getMessageContent(clientMsgNo);
      console.log('   Updated content:', updatedContent?.substring(0, 100));
    }, 100);
  } else {
    console.log('📋 Test 3: skipped (no usable test message found)');
  }
  
  console.log('');
  console.log('🧪 ========================================');
  console.log('🧪 Tests complete');
  console.log('🧪 ========================================');
};

/**
 * Show usage help
 */
export const showStreamTestHelp = (): void => {
  console.log('🧪 ========================================');
  console.log('🧪 AI streaming message test tool');
  console.log('🧪 ========================================');
  console.log('');
  console.log('Available commands:');
  console.log('');
  console.log('1. runStreamMessageTests()');
  console.log('   Run the full test suite');
  console.log('');
  console.log('2. listAllMessages()');
  console.log('   List all messages');
  console.log('');
  console.log('3. simulateStreamMessage(clientMsgNo, content)');
  console.log('   Simulate a single stream message chunk');
  console.log('   Example: simulateStreamMessage("msg-123", "Hello ")');
  console.log('');
  console.log('4. simulateAIStreamResponse(clientMsgNo, fullResponse, chunkSize, delayMs)');
  console.log('   Simulate a complete AI streaming reply');
  console.log('   Example: simulateAIStreamResponse("msg-123", "Full reply content", 10, 100)');
  console.log('');
  console.log('5. testMarkdownStreamResponse(clientMsgNo)');
  console.log('   Test a Markdown-formatted streaming reply');
  console.log('   Example: testMarkdownStreamResponse("msg-123")');
  console.log('');
  console.log('6. checkMessageExists(clientMsgNo)');
  console.log('   Check whether a message exists');
  console.log('');
  console.log('7. getMessageContent(clientMsgNo)');
  console.log('   Get the message content');
  console.log('');
  console.log('🧪 ========================================');
};

// Add the test functions to the global object in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).simulateStreamMessage = simulateStreamMessage;
  (window as any).simulateAIStreamResponse = simulateAIStreamResponse;
  (window as any).testMarkdownStreamResponse = testMarkdownStreamResponse;
  (window as any).checkMessageExists = checkMessageExists;
  (window as any).getMessageContent = getMessageContent;
  (window as any).listAllMessages = listAllMessages;
  (window as any).testStreamHandlerRegistration = testStreamHandlerRegistration;
  (window as any).runStreamMessageTests = runStreamMessageTests;
  (window as any).showStreamTestHelp = showStreamTestHelp;
  
  console.log('🧪 AI streaming message test tool loaded');
  console.log('🧪 Use showStreamTestHelp() for help');
}

