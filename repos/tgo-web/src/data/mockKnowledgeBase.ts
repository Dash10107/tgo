import type { KnowledgeBaseItem } from '@/types';

export const mockKnowledgeBases: KnowledgeBaseItem[] = [
  {
    id: '1',
    title: 'Product Knowledge Base',
    content: 'Covers all product models, specifications, prices and FAQs; continuously updated and used to answer pre-sales inquiries.',
    category: 'product',
    tags: ['Product', 'Official', 'Core'],
    author: 'Product Team',
    createdAt: '2023-03-01',
    updatedAt: '2023-03-18',
    views: 156,
    status: 'published'
  },
  {
    id: '2',
    title: 'Technical Support Docs',
    content: 'Detailed product technical specifications, troubleshooting steps and solutions for the internal technical support team.',
    category: 'support',
    tags: ['Technical', 'Troubleshooting'],
    author: 'Technical Team',
    createdAt: '2023-02-15',
    updatedAt: '2023-03-12',
    views: 212,
    status: 'draft'
  },
  {
    id: '3',
    title: 'Training Materials',
    content: 'Internal employee training documents and learning resources, accessible only to HR and the training department.',
    category: 'training',
    tags: ['Training', 'Internal'],
    author: 'HR Team',
    createdAt: '2023-02-20',
    updatedAt: '2023-03-10',
    views: 45,
    status: 'archived'
  }
];
