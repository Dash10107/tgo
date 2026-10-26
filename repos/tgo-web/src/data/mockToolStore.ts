import type { ToolStoreItem, ToolStoreCategory } from '@/types';

/**
 * Tool Store Categories
 */
export const TOOL_STORE_CATEGORIES: ToolStoreCategory[] = [
  { id: 'all', slug: 'all', name_zh: 'All', name_en: 'All', icon: 'Grid3X3', label: 'All' },
  { id: 'model', slug: 'model', name_zh: 'Models', name_en: 'Models', icon: 'Brain', label: 'Models' },
  { id: 'tool', slug: 'tool', name_zh: 'Tools', name_en: 'Tools', icon: 'Wrench', label: 'Tools' },
  { id: 'agent', slug: 'agent', name_zh: 'Agent Strategies', name_en: 'Agent Strategies', icon: 'Bot', label: 'Agent Strategies' },
  { id: 'extension', slug: 'extension', name_zh: 'Extensions', name_en: 'Extensions', icon: 'Puzzle', label: 'Extensions' },
  { id: 'plugin', slug: 'plugin', name_zh: 'Plugin Library', name_en: 'Plugins', icon: 'Package', label: 'Plugin Library' },
];

/**
 * Mock Tool Store Items
 */
export const mockToolStoreItems: ToolStoreItem[] = [
  {
    id: 'mcp-sse-streamable-http',
    name: 'Tool SSE / StreamableHTTP',
    description: 'Uses the Tool protocol over HTTP with SSE or Streamable HTTP transport to connect to and manage tools.',
    author: 'langgenius',
    authorHandle: 'mcp_sse',
    category: 'tool',
    categories: [TOOL_STORE_CATEGORIES[2]], // Tools
    tags: ['HTTP', 'SSE', 'Streamable', 'Tool'],
    downloads: 71652,
    rating: 4.8,
    ratingCount: 234,
    version: '1.2.0',
    lastUpdated: '2024-01-15',
    featured: true,
    verified: true,
    icon: '🔗',
    screenshots: [],
    longDescription: `# Tool SSE / StreamableHTTP

This is a powerful **tool** that connects to and manages various tools and services over HTTP with SSE or Streamable HTTP transport.

## Key Features

- **High-performance connection**: supports Server-Sent Events (SSE) real-time communication
- **Streaming transport**: optimized Streamable HTTP protocol support
- **Auto-reconnect**: built-in reconnection when the connection drops
- **Error handling**: thorough error handling and logging

## Use Cases

1. **Real-time data sync**: for applications that need real-time data updates
2. **Long-lived connections**: services that keep connections open for long periods
3. **Streaming data processing**: scenarios that process large data streams

> **Note**: make sure the server supports SSE or Streamable HTTP before use.

More information: [Official docs](https://example.com/docs).`,
    requirements: ['Node.js >= 16', 'HTTP Server'],
    changelog: 'Fixed connection stability issues and added an error retry mechanism.',
    methods: [
      {
        id: 'connect',
        name: 'connect',
        description: 'Establish a connection to the Tool server',
        parameters: [
          {
            name: 'url',
            type: 'string',
            required: true,
            description: 'URL of the Tool server',
            example: 'http://localhost:3000/mcp'
          },
          {
            name: 'options',
            type: 'object',
            required: false,
            description: 'Connection options',
            example: '{ timeout: 5000, retries: 3 }'
          }
        ],
        returnType: 'Promise<Connection>',
        example: 'await mcp.connect("http://localhost:3000/mcp", { timeout: 5000 })'
      },
      {
        id: 'send',
        name: 'send',
        description: 'Send a message to the Tool server',
        parameters: [
          {
            name: 'message',
            type: 'object',
            required: true,
            description: 'Message object to send',
            example: '{ type: "request", method: "tools/list" }'
          }
        ],
        returnType: 'Promise<Response>',
        example: 'await mcp.send({ type: "request", method: "tools/list" })'
      },
      {
        id: 'disconnect',
        name: 'disconnect',
        description: 'Disconnect from the Tool server',
        parameters: [],
        returnType: 'Promise<void>',
        example: 'await mcp.disconnect()'
      }
    ]
  },
  {
    id: 'tavily-search',
    name: 'Tavily',
    description: 'A powerful AI search engine that gives AI agents real-time web search and returns accurate, relevant results.',
    author: 'langgenius',
    authorHandle: 'tavily',
    category: 'tool',
    categories: [TOOL_STORE_CATEGORIES[2]], // Tools
    tags: ['Search', 'AI', 'Web', 'Real-time'],
    downloads: 69261,
    rating: 4.9,
    ratingCount: 189,
    version: '2.1.0',
    lastUpdated: '2024-01-12',
    featured: true,
    verified: true,
    icon: '🔍',
    screenshots: [],
    longDescription: `# Tavily AI Search Engine

**Tavily** is a search engine designed for AI agents that provides real-time, accurate web search results.

## Core Strengths

- **AI-optimized**: designed specifically for AI agents and automation systems
- **Real-time search**: provides the latest web information and data
- **High accuracy**: intelligent filtering and ranking of search results
- **Fast response**: average response time < 200ms

## Supported Search Types

1. **Web search**: search across all web content
2. **News search**: real-time news and information
3. **Academic search**: academic papers and research material

### API Features

- RESTful API interface
- JSON responses
- Batch queries supported
- Built-in caching

*Suitable for all kinds of AI application scenarios, providing a reliable information retrieval service.*`,
    requirements: ['API Key', 'Internet Connection'],
    changelog: 'Added search result filtering and improved search accuracy.',
    methods: [
      {
        id: 'search',
        name: 'search',
        description: 'Run a web search query',
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'Search query string',
            example: 'Latest developments in AI'
          },
          {
            name: 'maxResults',
            type: 'number',
            required: false,
            description: 'Maximum number of results to return',
            example: '10'
          }
        ],
        returnType: 'Promise<SearchResult[]>',
        example: 'await tavily.search("Latest developments in AI", 10)'
      },
      {
        id: 'searchNews',
        name: 'searchNews',
        description: 'Search the latest news',
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'News search query',
            example: 'Tech news'
          }
        ],
        returnType: 'Promise<NewsResult[]>',
        example: 'await tavily.searchNews("Tech news")'
      }
    ]
  },
  {
    id: 'json-processor',
    name: 'JSON Processing',
    description: 'A tool that processes JSON content using jsonpath_ng',
    author: 'langgenius',
    authorHandle: 'json_process',
    category: 'tool',
    categories: [TOOL_STORE_CATEGORIES[2]], // Tools
    tags: ['JSON', 'Processing', 'Data'],
    downloads: 65407,
    rating: 4.7,
    ratingCount: 156,
    version: '1.5.2',
    lastUpdated: '2024-01-10',
    featured: false,
    verified: true,
    icon: '📄',
    screenshots: [],
    longDescription: 'A powerful JSON processing tool that supports complex JSON path queries and data transformations.',
    requirements: ['Python >= 3.8'],
    changelog: 'Improved large-file processing performance and fixed a path parsing bug.'
  },
  {
    id: 'markdown-exporter',
    name: 'Markdown Exporter',
    description: 'Exports Markdown to DOCX, PPTX, XLSX, PDF, PNG, HTML, MD, CSV, JSON, JSONL, XML and other formats',
    author: 'bowenliang123',
    authorHandle: 'md_exporter',
    category: 'tool',
    categories: [TOOL_STORE_CATEGORIES[2]], // Tools
    tags: ['Markdown', 'Export', 'Document'],
    downloads: 62648,
    rating: 4.6,
    ratingCount: 203,
    version: '3.0.1',
    lastUpdated: '2024-01-08',
    featured: false,
    verified: true,
    icon: '📝',
    screenshots: [],
    longDescription: 'An all-purpose Markdown export tool that supports many output formats to meet a wide range of document needs.',
    requirements: ['Pandoc', 'LibreOffice'],
    changelog: 'Added XML format support and improved PDF export quality.'
  },
  {
    id: 'google-search',
    name: 'Google',
    description: 'An AI agent tool for fetching Google SERP search results, giving AI real-time web search capability.',
    author: 'langgenius',
    authorHandle: 'google',
    category: 'tool',
    categories: [TOOL_STORE_CATEGORIES[2]], // Tools
    tags: ['Google', 'Search', 'SERP'],
    downloads: 53954,
    rating: 4.5,
    ratingCount: 178,
    version: '1.8.0',
    lastUpdated: '2024-01-05',
    featured: false,
    verified: true,
    icon: '🔍',
    screenshots: [],
    longDescription: 'An AI agent tool that integrates Google search and returns accurate search results.',
    requirements: ['Google API Key'],
    changelog: 'Added search result caching and improved response speed.'
  },
  {
    id: 'firecrawl-api',
    name: 'Firecrawl',
    description: 'Firecrawl API integration for web content scraping and data extraction.',
    author: 'langgenius',
    authorHandle: 'firecrawl',
    category: 'tool',
    categories: [TOOL_STORE_CATEGORIES[2]], // Tools
    tags: ['Web Scraping', 'API', 'Data'],
    downloads: 39930,
    rating: 4.4,
    ratingCount: 145,
    version: '2.3.0',
    lastUpdated: '2024-01-03',
    featured: false,
    verified: true,
    icon: '🔥',
    screenshots: [],
    longDescription: 'A powerful web scraping tool that supports dynamic content extraction and data cleaning.',
    requirements: ['Firecrawl API Key'],
    changelog: 'Supports more website types and adds anti-bot detection.'
  }
];

/**
 * Get featured tools
 */
export const getFeaturedTools = (): ToolStoreItem[] => {
  return mockToolStoreItems.filter(item => item.featured);
};

/**
 * Get tools by category
 */
export const getToolsByCategory = (categoryId: string): ToolStoreItem[] => {
  if (categoryId === 'all') {
    return mockToolStoreItems;
  }
  return mockToolStoreItems.filter(item => item.category === categoryId);
};

/**
 * Search tools
 */
export const searchTools = (query: string, categoryId?: string): ToolStoreItem[] => {
  let tools = categoryId && categoryId !== 'all' 
    ? getToolsByCategory(categoryId) 
    : mockToolStoreItems;

  if (!query.trim()) {
    return tools;
  }

  const searchTerm = query.toLowerCase().trim();
  return tools.filter(tool =>
    (tool.name?.toLowerCase().includes(searchTerm)) ||
    (tool.description?.toLowerCase().includes(searchTerm)) ||
    (tool.author?.toLowerCase().includes(searchTerm)) ||
    (tool.tags?.some(tag => tag.toLowerCase().includes(searchTerm)))
  );
};
