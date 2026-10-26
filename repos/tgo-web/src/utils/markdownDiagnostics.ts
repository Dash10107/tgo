/**
 * Markdown rendering problem diagnostics tool
 * Used to quickly diagnose the has_stream_data flag and Markdown rendering problems
 */

interface DiagnosticResult {
  category: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  message: string;
  details?: any;
  suggestion?: string;
}

/**
 * Diagnose the metadata structure of a message object
 */
export const diagnoseMessageMetadata = (message: any): DiagnosticResult[] => {
  const results: DiagnosticResult[] = [];
  
  // Check whether the message object exists
  if (!message) {
    results.push({
      category: 'Message object',
      status: 'fail',
      message: 'Message object does not exist',
      suggestion: 'Make sure a valid message object is passed in'
    });
    return results;
  }
  
  // Check the metadata field
  if (!message.metadata) {
    results.push({
      category: 'metadata',
      status: 'fail',
      message: 'metadata field does not exist',
      details: { message },
      suggestion: 'Check that the message conversion logic sets metadata correctly'
    });
  } else {
    results.push({
      category: 'metadata',
      status: 'pass',
      message: 'metadata field exists',
      details: { keys: Object.keys(message.metadata) }
    });
  }
  
  // Check the has_stream_data field
  if (!message.metadata?.has_stream_data) {
    results.push({
      category: 'has_stream_data',
      status: 'warning',
      message: 'has_stream_data field is false or missing',
      details: { 
        value: message.metadata?.has_stream_data,
        type: typeof message.metadata?.has_stream_data
      },
      suggestion: 'If this is an AI reply, check whether the original WuKongIM message contains the stream_data field'
    });
  } else {
    results.push({
      category: 'has_stream_data',
      status: 'pass',
      message: 'has_stream_data field is true',
      details: { value: message.metadata.has_stream_data }
    });
  }
  
  // Check the wukongim metadata
  if (!message.metadata?.wukongim) {
    results.push({
      category: 'wukongim metadata',
      status: 'warning',
      message: 'wukongim metadata does not exist',
      suggestion: 'Check that the message was converted correctly from the WuKongIM format'
    });
  } else {
    results.push({
      category: 'wukongim metadata',
      status: 'pass',
      message: 'wukongim metadata exists',
      details: { 
        message_id: message.metadata.wukongim.message_id,
        channel_id: message.metadata.wukongim.channel_id,
        from_uid: message.metadata.wukongim.from_uid
      }
    });
  }
  
  // Check the message content
  if (!message.content || message.content.trim() === '') {
    results.push({
      category: 'Message content',
      status: 'warning',
      message: 'Message content is empty',
      suggestion: 'Check the message content extraction logic'
    });
  } else {
    results.push({
      category: 'Message content',
      status: 'pass',
      message: `Message content exists (${message.content.length} characters)`,
      details: { preview: message.content.substring(0, 100) }
    });
  }
  
  return results;
};

/**
 * Diagnose a raw WuKongIM message
 */
export const diagnoseWuKongIMMessage = (wkMessage: any): DiagnosticResult[] => {
  const results: DiagnosticResult[] = [];
  
  if (!wkMessage) {
    results.push({
      category: 'WuKongIM message',
      status: 'fail',
      message: 'WuKongIM message object does not exist',
      suggestion: 'Make sure a valid WuKongIM message object is passed in'
    });
    return results;
  }
  
  // Check the stream_data field
  const hasStreamDataField = 'stream_data' in wkMessage;
  const streamDataValue = wkMessage.stream_data;
  const streamDataTrimmed = streamDataValue?.trim?.();
  const hasValidStreamData = !!(streamDataValue && streamDataTrimmed !== '');
  
  if (!hasStreamDataField) {
    results.push({
      category: 'stream_data field',
      status: 'warning',
      message: 'stream_data field does not exist',
      details: { 
        available_fields: Object.keys(wkMessage),
        has_payload: 'payload' in wkMessage
      },
      suggestion: 'This may be a regular message (not an AI reply), or the API response format may have changed'
    });
  } else if (!hasValidStreamData) {
    results.push({
      category: 'stream_data field',
      status: 'warning',
      message: 'stream_data field exists but is empty or null',
      details: { 
        value: streamDataValue,
        type: typeof streamDataValue,
        length: streamDataValue?.length
      },
      suggestion: 'This may be a regular message that does not need Markdown rendering'
    });
  } else {
    results.push({
      category: 'stream_data field',
      status: 'pass',
      message: 'stream_data field exists and has a valid value',
      details: { 
        length: streamDataValue.length,
        preview: streamDataValue.substring(0, 100) + '...'
      }
    });
  }
  
  // Check the payload field
  if (!wkMessage.payload) {
    results.push({
      category: 'payload field',
      status: 'warning',
      message: 'payload field does not exist',
      suggestion: 'Check that the WuKongIM message format is correct'
    });
  } else {
    const payloadType = typeof wkMessage.payload;
    const hasContent = payloadType === 'object' && wkMessage.payload.content;
    
    results.push({
      category: 'payload field',
      status: 'pass',
      message: `payload field exists (type: ${payloadType})`,
      details: { 
        type: payloadType,
        hasContent,
        content_preview: hasContent ? wkMessage.payload.content.substring(0, 50) : null
      }
    });
  }
  
  // Check other key fields
  const requiredFields = ['message_id', 'from_uid', 'channel_id', 'channel_type', 'timestamp'];
  requiredFields.forEach(field => {
    if (!(field in wkMessage)) {
      results.push({
        category: `Required field: ${field}`,
        status: 'warning',
        message: `${field} field does not exist`,
        suggestion: 'Check the WuKongIM message format'
      });
    }
  });
  
  return results;
};

/**
 * Run the full diagnosis
 */
export const runFullDiagnostics = (wkMessage?: any, convertedMessage?: any): void => {
  console.log('🔍 ========================================');
  console.log('🔍 Markdown rendering diagnostics');
  console.log('🔍 ========================================');
  console.log('');
  
  // Diagnose the raw WuKongIM message
  if (wkMessage) {
    console.log('📋 1. WuKongIM raw message diagnostics');
    console.log('-------------------------------------------');
    const wkResults = diagnoseWuKongIMMessage(wkMessage);
    wkResults.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : 
                   result.status === 'fail' ? '❌' : 
                   result.status === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${icon} [${result.category}] ${result.message}`);
      if (result.details) {
        console.log('   Details:', result.details);
      }
      if (result.suggestion) {
        console.log('   💡 Suggestion:', result.suggestion);
      }
    });
    console.log('');
  } else {
    console.log('⚠️ No WuKongIM raw message provided; skipping raw message diagnostics');
    console.log('');
  }
  
  // Diagnose the converted message
  if (convertedMessage) {
    console.log('📋 2. Converted message diagnostics');
    console.log('-------------------------------------------');
    const msgResults = diagnoseMessageMetadata(convertedMessage);
    msgResults.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : 
                   result.status === 'fail' ? '❌' : 
                   result.status === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${icon} [${result.category}] ${result.message}`);
      if (result.details) {
        console.log('   Details:', result.details);
      }
      if (result.suggestion) {
        console.log('   💡 Suggestion:', result.suggestion);
      }
    });
    console.log('');
  } else {
    console.log('⚠️ No converted message provided; skipping converted message diagnostics');
    console.log('');
  }
  
  // Summary and recommendations
  console.log('📋 3. Summary and recommendations');
  console.log('-------------------------------------------');
  
  if (wkMessage && convertedMessage) {
    const hasStreamData = wkMessage.stream_data && wkMessage.stream_data.trim() !== '';
    const hasStreamDataFlag = convertedMessage.metadata?.has_stream_data;
    
    if (hasStreamData && !hasStreamDataFlag) {
      console.log('❌ Problem: the WuKongIM message has stream_data but the converted message has no has_stream_data flag');
      console.log('💡 Suggestions:');
      console.log('   1. Check the convertWuKongIMToMessage method in src/stores/chatStore.ts');
      console.log('   2. Make sure metadata contains the has_stream_data field');
      console.log('   3. Check the convertToMessage method in src/services/wukongimApi.ts');
    } else if (hasStreamData && hasStreamDataFlag) {
      console.log('✅ OK: stream_data and the has_stream_data flag are both correct');
      console.log('💡 If Markdown still does not render, check:');
      console.log('   1. Whether the MarkdownContent component is imported correctly');
      console.log('   2. Whether the react-markdown dependency is installed');
      console.log('   3. Whether the browser console shows errors');
    } else if (!hasStreamData) {
      console.log('ℹ️ This is a regular message (no stream_data); Markdown rendering is not needed');
    }
  } else {
    console.log('ℹ️ Provide both the raw WuKongIM message and the converted message for a full diagnosis');
    console.log('💡 Usage:');
    console.log('   runFullDiagnostics(wkMessage, convertedMessage)');
  }
  
  console.log('');
  console.log('🔍 ========================================');
  console.log('🔍 Diagnosis complete');
  console.log('🔍 ========================================');
};

/**
 * Check all messages on the page
 */
export const diagnoseAllMessagesOnPage = (): void => {
  console.log('🔍 Checking all messages on the page...');
  console.log('');
  
  // Try to get messages from React DevTools or global state
  // Here we check the message elements in the DOM
  const messageElements = document.querySelectorAll('[class*="ChatMessage"]');
  
  if (messageElements.length === 0) {
    console.log('⚠️ No message elements found on the page');
    console.log('💡 Suggestion: visit the test page /test/markdown or open a chat conversation');
    return;
  }
  
  console.log(`📊 Found ${messageElements.length} message elements`);
  console.log('');
  
  // Check the Markdown content elements
  const markdownElements = document.querySelectorAll('.markdown-content');
  console.log(`📊 Found ${markdownElements.length} Markdown content elements`);
  
  if (markdownElements.length === 0) {
    console.log('⚠️ No Markdown content elements found');
    console.log('💡 Possible causes:');
    console.log('   1. has_stream_data is false for all messages');
    console.log('   2. The MarkdownContent component did not render correctly');
    console.log('   3. There are no AI reply messages on the page');
  } else {
    console.log('✅ Markdown content elements found; Markdown rendering is working');
    
    markdownElements.forEach((el, i) => {
      console.log(`   ${i + 1}. Markdown element:`, {
        hasWhiteClass: el.classList.contains('markdown-white'),
        childrenCount: el.children.length,
        textLength: el.textContent?.length
      });
    });
  }
  
  console.log('');
  console.log('💡 To diagnose a specific message, use:');
  console.log('   diagnoseMessageMetadata(message)');
  console.log('   diagnoseWuKongIMMessage(wkMessage)');
  console.log('   runFullDiagnostics(wkMessage, convertedMessage)');
};

// Add the diagnostic functions to the global object in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).diagnoseMessageMetadata = diagnoseMessageMetadata;
  (window as any).diagnoseWuKongIMMessage = diagnoseWuKongIMMessage;
  (window as any).runFullDiagnostics = runFullDiagnostics;
  (window as any).diagnoseAllMessagesOnPage = diagnoseAllMessagesOnPage;
  
  console.log('🔍 Markdown diagnostics tool loaded');
  console.log('🔍 Available commands:');
  console.log('   - diagnoseMessageMetadata(message)');
  console.log('   - diagnoseWuKongIMMessage(wkMessage)');
  console.log('   - runFullDiagnostics(wkMessage, convertedMessage)');
  console.log('   - diagnoseAllMessagesOnPage()');
}

