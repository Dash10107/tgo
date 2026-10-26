import React, { useState } from 'react';
import ChatMessage from '@/components/chat/ChatMessage';
import type { Message } from '@/types';
import { markdownExamples } from '@/utils/markdownTest';

/**
 * Markdown rendering test page
 * Used to verify and test Markdown rendering
 */
const MarkdownTestPage: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState<string>('aiResponse');

  // Create a test message
  const createTestMessage = (
    id: string,
    content: string,
    type: 'visitor' | 'staff',
    hasStreamData: boolean
  ): Message => {
    return {
      id,
      content,
      timestamp: new Date().toISOString(),
      type,
      fromInfo: {
        name: type === 'visitor' ? 'Test Visitor' : 'AI Assistant',
        avatar: type === 'visitor'
          ? 'https://i.pravatar.cc/32?img=1'
          : 'https://i.pravatar.cc/32?img=2',
        channel_id: type === 'visitor' ? 'test-visitor' : 'test-staff',
        channel_type: 1
      },
      platform: 'wechat',
      payloadType: 1,
      status: 'delivered',
      isRead: false,
      metadata: {
        has_stream_data: hasStreamData
      }
    };
  };

  // Test message list
  const testMessages: Array<{ title: string; message: Message }> = [
    {
      title: 'Visitor message - with Markdown (stream_data)',
      message: createTestMessage(
        '1',
        markdownExamples[selectedExample as keyof typeof markdownExamples],
        'visitor',
        true
      )
    },
    {
      title: 'Visitor message - plain text (no stream_data)',
      message: createTestMessage(
        '2',
        'This is a regular text message and should not render Markdown. **This should not be bold**',
        'visitor',
        false
      )
    },
    {
      title: 'AI assistant message - with Markdown (stream_data)',
      message: createTestMessage(
        '3',
        markdownExamples[selectedExample as keyof typeof markdownExamples],
        'staff',
        true
      )
    },
    {
      title: 'AI assistant message - plain text (no stream_data)',
      message: createTestMessage(
        '4',
        'This is a regular AI reply and should not render Markdown. **This should not be bold**',
        'staff',
        false
      )
    }
  ];

  const exampleOptions = [
    { value: 'basic', label: 'Basic formatting' },
    { value: 'lists', label: 'Lists' },
    { value: 'code', label: 'Code blocks' },
    { value: 'links', label: 'Links and images' },
    { value: 'blockquote', label: 'Blockquote' },
    { value: 'table', label: 'Table' },
    { value: 'mixed', label: 'Mixed formatting' },
    { value: 'aiResponse', label: 'AI reply example' }
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Page title */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Markdown Rendering Test
          </h1>
          <p className="text-gray-600">
            Verify that Markdown rendering of the stream_data field works correctly
          </p>
        </div>

        {/* Control panel */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Select a test example
          </h2>
          <div className="flex flex-wrap gap-2">
            {exampleOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setSelectedExample(option.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedExample === option.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Test notes */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📋 Test notes
          </h3>
          <ul className="space-y-2 text-blue-800">
            <li>✅ Messages with <code className="bg-blue-100 px-2 py-0.5 rounded">stream_data</code> should render Markdown formatting</li>
            <li>✅ Messages without <code className="bg-blue-100 px-2 py-0.5 rounded">stream_data</code> should show plain text</li>
            <li>✅ Visitor messages use a white background with dark text</li>
            <li>✅ AI assistant messages use a blue background with white text</li>
            <li>✅ Code blocks should have a language label and a gray background</li>
            <li>✅ Links should open in a new window</li>
          </ul>
        </div>

        {/* Test message display */}
        <div className="space-y-6">
          {testMessages.map(({ title, message }, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    message.metadata?.has_stream_data
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {message.metadata?.has_stream_data ? 'Markdown rendering' : 'Plain text'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    message.type === 'visitor'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {message.type === 'visitor' ? 'Visitor' : 'AI Assistant'}
                  </span>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg">
                <ChatMessage message={message} />
              </div>
            </div>
          ))}
        </div>

        {/* Console test commands */}
        <div className="bg-gray-900 text-gray-100 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-3">
            🧪 Console test commands
          </h3>
          <div className="space-y-2 font-mono text-sm">
            <div className="bg-gray-800 p-3 rounded">
              <span className="text-green-400">// Run all tests</span>
              <br />
              <span className="text-yellow-300">runAllMarkdownTests()</span>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <span className="text-green-400">// Check Markdown elements</span>
              <br />
              <span className="text-yellow-300">testMarkdownRendering()</span>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <span className="text-green-400">// View example content</span>
              <br />
              <span className="text-yellow-300">console.log(markdownExamples.aiResponse)</span>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <span className="text-green-400">// Check dependencies</span>
              <br />
              <span className="text-yellow-300">checkMarkdownDependencies()</span>
            </div>
          </div>
        </div>

        {/* Raw content preview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📝 Raw Markdown content of the current example
          </h3>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
            <code className="text-gray-800">
              {markdownExamples[selectedExample as keyof typeof markdownExamples]}
            </code>
          </pre>
        </div>

        {/* Checklist */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ✓ Feature checklist
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Markdown elements</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>□ Headings (H1-H6)</li>
                <li>□ Bold and italic</li>
                <li>□ Lists (ordered/unordered)</li>
                <li>□ Code blocks and inline code</li>
                <li>□ Links and images</li>
                <li>□ Tables</li>
                <li>□ Blockquotes</li>
                <li>□ Horizontal rules</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Styles and behavior</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>□ Visitor message styling is correct</li>
                <li>□ AI message styling is correct (white text)</li>
                <li>□ Code blocks have a language label</li>
                <li>□ Links open in a new window</li>
                <li>□ Plain text messages do not render Markdown</li>
                <li>□ Images are lazy-loaded</li>
                <li>□ Responsive layout</li>
                <li>□ No console errors</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownTestPage;

