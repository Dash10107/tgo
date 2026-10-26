import type { AiTool, ToolCategory } from '@/types';

export const mockAiTools: AiTool[] = [
  {
    id: '1',
    name: 'Kuaidi100 Lookup',
    description: 'Look up live courier and logistics information; supports major courier companies',
    category: 'integration',
    status: 'active',
    version: 'v1.2.0',
    author: 'Kuaidi100',
    lastUpdated: '2024-01-15',
    usageCount: 1250,
    rating: 4.8,
    tags: ['Logistics', 'Courier', 'API'],
    capabilities: ['Live lookup', 'Multi-courier support', 'Status tracking', 'Exception alerts'],
    successRate: 98,
    avgResponseTime: '120ms',
    config: {
      apiKey: 'required',
      timeout: 5000,
      retryCount: 3
    }
  },
  {
    id: '2',
    name: 'User Profile Analysis',
    description: 'Generates detailed user profile reports from user behavior data',
    category: 'data',
    status: 'error',
    version: 'v2.1.3',
    author: 'Data Team',
    lastUpdated: '2024-01-12',
    usageCount: 890,
    rating: 4.5,
    tags: ['Data analysis', 'User profile', 'AI'],
    capabilities: ['Behavior analysis', 'Tag generation', 'Trend prediction', 'Report export'],
    successRate: 85,
    avgResponseTime: '2.5s',
    config: {
      dataSource: 'required',
      analysisDepth: 'deep',
      outputFormat: 'json'
    }
  },
  {
    id: '3',
    name: 'Smart Support Assistant',
    description: 'Provides intelligent conversation and auto-reply features',
    category: 'ai',
    status: 'active',
    version: 'v3.0.1',
    author: 'AI Team',
    lastUpdated: '2024-01-14',
    usageCount: 2100,
    rating: 4.9,
    tags: ['AI', 'Conversation', 'Auto-reply'],
    capabilities: ['Intelligent conversation', 'Sentiment recognition', 'Multi-turn dialogue', 'Knowledge base integration'],
    successRate: 96,
    avgResponseTime: '800ms',
    config: {
      model: 'gpt-3.5-turbo',
      maxTokens: 2048,
      temperature: 0.7
    }
  },
  {
    id: '4',
    name: 'Email Sending Service',
    description: 'Bulk email sending and email template management',
    category: 'communication',
    status: 'active',
    version: 'v1.5.2',
    author: 'Communications Team',
    lastUpdated: '2024-01-13',
    usageCount: 567,
    rating: 4.3,
    tags: ['Email', 'Communication', 'Template'],
    capabilities: ['Bulk sending', 'Template management', 'Send statistics', 'Bounce handling'],
    successRate: 94,
    avgResponseTime: '1.2s',
    config: {
      smtpServer: 'required',
      maxBatchSize: 100,
      retryAttempts: 3
    }
  },
  {
    id: '5',
    name: 'Document Generator',
    description: 'Automatically generates all kinds of business documents and reports',
    category: 'productivity',
    status: 'updating',
    version: 'v2.3.0',
    author: 'Office Team',
    lastUpdated: '2024-01-10',
    usageCount: 345,
    rating: 4.2,
    tags: ['Document', 'Report', 'Automation'],
    capabilities: ['Template generation', 'Data filling', 'Format conversion', 'Batch processing'],
    successRate: 92,
    avgResponseTime: '3.1s',
    config: {
      templatePath: 'required',
      outputFormat: ['pdf', 'docx', 'html'],
      maxFileSize: '10MB'
    }
  },
  {
    id: '6',
    name: 'Payment Gateway',
    description: 'A unified interface integrating multiple payment methods',
    category: 'integration',
    status: 'active',
    version: 'v4.1.0',
    author: 'Payments Team',
    lastUpdated: '2024-01-15',
    usageCount: 1890,
    rating: 4.7,
    tags: ['Payment', 'API', 'Integration'],
    capabilities: ['Multiple payment methods', 'Secure encryption', 'Transaction records', 'Refund handling'],
    successRate: 99,
    avgResponseTime: '450ms',
    config: {
      merchantId: 'required',
      secretKey: 'required',
      callbackUrl: 'required',
      timeout: 30000
    }
  }
];

// Tool categories
export const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'communication', label: 'Communication' },
  { id: 'data', label: 'Data Analysis' },
  { id: 'ai', label: 'AI Tools' },
  { id: 'integration', label: 'Integrations' }
];
