import type { Agent } from '@/types';

export const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Zhang San',
    description: 'Receives order query tasks and dispatches them to the relevant experts. This is an example of a coordinator Agent; its description may be fairly long and need to be truncated...',
    avatar: 'https://i.pravatar.cc/48?img=1',
    status: 'active',
    type: 'coordinator',
    role: 'Support Coordinator',
    llmModel: 'gemini-1.5-pro',
    endpoint: 'http://127.0.0.1:8001/a2a',
    capabilities: ['Order query', 'Task dispatch', 'Support coordination'],
    lastActive: '2024-01-15 14:30',
    conversationCount: 156,
    successRate: 95.2,
    responseTime: '1.2s',
    tags: ['Coordinator', 'Coordinator', 'gemini-1.5-pro'],
    tools: ['1', '3'], // Linked to the courier query and database query tools
    knowledgeBases: ['1', '2'] // Linked to the product and support knowledge bases
  },
  {
    id: '2',
    name: 'Li Si',
    description: 'Calls the Kuaidi100 Tool service to query live courier status.',
    avatar: 'https://i.pravatar.cc/48?img=2',
    status: 'inactive',
    type: 'expert',
    role: 'Courier Query Specialist',
    llmModel: 'gemini-1.5-flash',
    endpoint: 'http://127.0.0.1:8002/a2a',
    capabilities: ['Courier query', 'Logistics tracking', 'Tool service'],
    lastActive: '2024-01-15 12:15',
    conversationCount: 89,
    successRate: 98.7,
    responseTime: '0.8s',
    tags: ['Courier', 'Expert', 'gemini-1.5-flash'],
    tools: ['1'], // Linked to the courier query tool
    knowledgeBases: ['3'] // Linked to the logistics knowledge base
  },
  {
    id: '3',
    name: 'Wang Wu',
    description: 'Generates user profile reports from user data (Tool connection failed).',
    avatar: 'https://i.pravatar.cc/48?img=3',
    status: 'error',
    type: 'expert',
    role: 'User Profile Analyst',
    llmModel: 'gemini-1.0-pro',
    endpoint: '-',
    capabilities: ['User profiling', 'Data analysis', 'Behavior analysis'],
    lastActive: '2024-01-15 15:45',
    conversationCount: 234,
    successRate: 92.8,
    responseTime: '2.1s',
    tags: ['Analyst', 'Analyst', 'claude-3-sonnet'],
    tools: ['2'], // Linked to the data analysis tool
    knowledgeBases: [] // No linked knowledge bases yet
  },
  {
    id: '4',
    name: 'Zhao Liu',
    description: 'Handles after-sales requests, including returns, exchanges and repairs.',
    avatar: 'https://i.pravatar.cc/48?img=4',
    status: 'active',
    type: 'expert',
    role: 'After-sales Specialist',
    llmModel: 'gpt-4-turbo',
    endpoint: 'http://127.0.0.1:8004/a2a',
    capabilities: ['After-sales service', 'Returns and exchanges', 'Repair consulting'],
    lastActive: '2024-01-15 11:20',
    conversationCount: 67,
    successRate: 88.5,
    responseTime: '1.8s',
    tags: ['After-sales', 'Support', 'gpt-4-turbo'],
    tools: ['4'], // Linked to the support tool
    knowledgeBases: ['2'] // Linked to the support knowledge base
  },
  {
    id: '5',
    name: 'Sun Qi',
    description: 'Specializes in technical support and answers product usage questions.',
    avatar: 'https://i.pravatar.cc/48?img=5',
    status: 'active',
    type: 'expert',
    role: 'Technical Support Specialist',
    llmModel: 'gemini-1.5-pro',
    endpoint: 'http://127.0.0.1:8005/a2a',
    capabilities: ['Technical support', 'Product consulting', 'Troubleshooting'],
    lastActive: '2024-01-15 16:10',
    conversationCount: 145,
    successRate: 94.1,
    responseTime: '1.5s',
    tags: ['Technical', 'Technical', 'gemini-1.5-pro'],
    tools: ['3'], // Linked to the database query tool
    knowledgeBases: ['1', '2'] // Linked to the product and support knowledge bases
  },
  {
    id: '6',
    name: 'Zhou Ba',
    description: 'Handles sales inquiries and product recommendations, offering professional purchase advice.',
    avatar: 'https://i.pravatar.cc/48?img=6',
    status: 'inactive',
    type: 'expert',
    role: 'Sales Consulting Specialist',
    llmModel: 'claude-3-haiku',
    endpoint: 'http://127.0.0.1:8006/a2a',
    capabilities: ['Sales consulting', 'Product recommendation', 'Pricing consulting'],
    lastActive: '2024-01-15 09:30',
    conversationCount: 78,
    successRate: 91.3,
    responseTime: '1.1s',
    tags: ['Sales', 'Sales', 'claude-3-haiku'],
    tools: [], // No linked tools yet
    knowledgeBases: ['1'] // Linked to the product knowledge base
  },
  // Test entries for default avatar generation
  {
    id: '7',
    name: 'Alice',
    description: 'English-language support specialist who handles inquiries and support for international customers.',
    avatar: '', // Empty avatar - should show "A" with red gradient
    status: 'active',
    type: 'expert',
    role: 'International Support',
    llmModel: 'gpt-4',
    endpoint: 'http://127.0.0.1:8007/a2a',
    capabilities: ['English support', 'International support', 'Cross-cultural communication'],
    lastActive: '2024-01-15 16:45',
    conversationCount: 234,
    successRate: 98.1,
    responseTime: '0.8s',
    tags: ['English', 'International', 'gpt-4'],
    tools: ['1', '4'], // Linked to the courier query and translation tools
    knowledgeBases: ['1', '3'] // Linked to the product and training knowledge bases
  },
  {
    id: '8',
    name: 'Bob',
    description: 'Technical support specialist who handles product technical issues and troubleshooting.',
    avatar: 'placeholder.jpg', // Invalid avatar - should show "B" with orange gradient
    status: 'inactive',
    type: 'expert',
    role: 'Technical Support',
    llmModel: 'claude-3-haiku',
    endpoint: 'http://127.0.0.1:8008/a2a',
    capabilities: ['Technical support', 'Troubleshooting', 'Product guidance'],
    lastActive: '2024-01-15 10:30',
    conversationCount: 167,
    successRate: 94.5,
    responseTime: '1.5s',
    tags: ['Technical', 'Technical', 'claude-3-haiku'],
    tools: ['2', '3'], // Linked to the payment system and database query tools
    knowledgeBases: ['1', '2'] // Linked to the product and support knowledge bases
  },
  {
    id: '9',
    name: 'Chen Qi',
    description: 'Sales consultant who handles product recommendations and sales consulting services.',
    avatar: '', // Empty avatar - should show "C" with appropriate color
    status: 'active',
    type: 'expert',
    role: 'Sales Consultant',
    llmModel: 'gemini-1.5-flash',
    endpoint: 'http://127.0.0.1:8009/a2a',
    capabilities: ['Product recommendation', 'Sales consulting', 'Customer relations'],
    lastActive: '2024-01-15 15:20',
    conversationCount: 298,
    successRate: 97.3,
    responseTime: '1.0s',
    tags: ['Sales', 'Sales', 'gemini-1.5-flash'],
    tools: ['1', '2'], // Linked to the courier query and payment system tools
    knowledgeBases: ['1', '3'] // Linked to the product and training knowledge bases
  }
];
