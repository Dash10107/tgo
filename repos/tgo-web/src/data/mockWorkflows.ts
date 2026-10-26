/**
 * Mock Workflow Data
 * Sample workflows for development and testing
 */

import type { Workflow, WorkflowSummary } from '@/types/workflow';

/**
 * Sample customer service workflow
 */
export const customerServiceWorkflow: Workflow = {
  id: 'wf-001',
  name: 'Customer Inquiry Handling Flow',
  description: 'Automatically handles customer inquiries and assigns them to the right AI agent or human agent based on the question type',
  status: 'active',
  version: 1,
  tags: ['Support', 'Automation'],
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-20T14:30:00Z',
  definition: {
    nodes: [
      {
        id: 'node-input',
        type: 'input',
        position: { x: 250, y: 50 },
        data: {
          type: 'input',
          label: 'User Input',
          description: 'Customer starts an inquiry',
          input_variables: [{ name: 'query', type: 'string', description: 'Message content entered by the customer' }],
          reference_key: 'input_1',
        },
      },
      {
        id: 'node-classify',
        type: 'llm',
        position: { x: 250, y: 150 },
        data: {
          type: 'llm',
          label: 'Question Classification',
          description: 'Use an LLM to classify the customer question',
          user_prompt: 'Analyze the following customer question and classify it: {{input_1.query}}. Categories: Technical support, Sales inquiry, Complaint or suggestion, Other.',
          reference_key: 'classify_1',
        },
      },
      {
        id: 'node-condition',
        type: 'condition',
        position: { x: 250, y: 280 },
        data: {
          type: 'condition',
          label: 'Determine Question Type',
          condition_type: 'variable',
          variable: 'classify_1.text',
          operator: 'equals',
          compare_value: 'Technical support',
          reference_key: 'condition_1',
        },
      },
      {
        id: 'node-tech-agent',
        type: 'agent',
        position: { x: 100, y: 400 },
        data: {
          type: 'agent',
          label: 'Technical Support Agent',
          agent_id: 'agent-tech-001',
          agent_name: 'Technical Support Specialist',
          reference_key: 'tech_agent_1',
        },
      },
      {
        id: 'node-sales-agent',
        type: 'agent',
        position: { x: 400, y: 400 },
        data: {
          type: 'agent',
          label: 'Sales Inquiry Agent',
          agent_id: 'agent-sales-001',
          agent_name: 'Sales Consultant',
          reference_key: 'sales_agent_1',
        },
      },
      {
        id: 'node-answer',
        type: 'answer',
        position: { x: 250, y: 520 },
        data: {
          type: 'answer',
          label: 'Reply',
          output_type: 'variable',
          output_variable: 'tech_agent_1.text',
          reference_key: 'answer_1',
        },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-input',
        target: 'node-classify',
        type: 'smoothstep',
      },
      {
        id: 'edge-2',
        source: 'node-classify',
        target: 'node-condition',
        type: 'smoothstep',
      },
      {
        id: 'edge-3',
        source: 'node-condition',
        target: 'node-tech-agent',
        type: 'smoothstep',
        data: { label: 'true' },
      },
      {
        id: 'edge-4',
        source: 'node-condition',
        target: 'node-sales-agent',
        type: 'smoothstep',
        data: { label: 'false' },
      },
      {
        id: 'edge-5',
        source: 'node-tech-agent',
        target: 'node-answer',
        type: 'smoothstep',
      },
      {
        id: 'edge-6',
        source: 'node-sales-agent',
        target: 'node-answer',
        type: 'smoothstep',
      },
    ],
  }
};

/**
 * Sample data processing workflow
 */
export const dataProcessingWorkflow: Workflow = {
  id: 'wf-002',
  name: 'Data Analysis Flow',
  description: 'Runs multiple data analysis tasks in parallel and generates a report from the combined results',
  status: 'active',
  version: 2,
  tags: ['Data analysis', 'Report'],
  created_at: '2024-01-10T09:00:00Z',
  updated_at: '2024-01-25T16:00:00Z',
  definition: {
    nodes: [
      {
        id: 'node-input',
        type: 'input',
        position: { x: 250, y: 50 },
        data: {
          type: 'input',
          label: 'User Input',
          input_variables: [{ name: 'query', type: 'string', description: 'Analysis instruction' }],
          reference_key: 'input_1',
        },
      },
      {
        id: 'node-parallel',
        type: 'parallel',
        position: { x: 250, y: 150 },
        data: {
          type: 'parallel',
          label: 'Parallel Analysis',
          branches: 3,
          wait_for_all: true,
          reference_key: 'parallel_1',
        },
      },
      {
        id: 'node-tool-1',
        type: 'tool',
        position: { x: 50, y: 280 },
        data: {
          type: 'tool',
          label: 'Data Query',
          tool_id: 'tool-db-query',
          tool_name: 'Database Query',
          reference_key: 'db_query_1',
        },
      },
      {
        id: 'node-tool-2',
        type: 'tool',
        position: { x: 250, y: 280 },
        data: {
          type: 'tool',
          label: 'API Call',
          tool_id: 'tool-api-call',
          tool_name: 'External API',
          reference_key: 'api_call_1',
        },
      },
      {
        id: 'node-tool-3',
        type: 'tool',
        position: { x: 450, y: 280 },
        data: {
          type: 'tool',
          label: 'File Processing',
          tool_id: 'tool-file-process',
          tool_name: 'File Processor',
          reference_key: 'file_process_1',
        },
      },
      {
        id: 'node-llm-summary',
        type: 'llm',
        position: { x: 250, y: 400 },
        data: {
          type: 'llm',
          label: 'Summary Analysis',
          user_prompt: 'Generate an analysis report from the following data:\nInstruction: {{input_1.query}}\nQuery result: {{db_query_1.result}}\nAPI result: {{api_call_1.result}}\nFile result: {{file_process_1.result}}',
          reference_key: 'summary_1',
        },
      },
      {
        id: 'node-answer',
        type: 'answer',
        position: { x: 250, y: 520 },
        data: {
          type: 'answer',
          label: 'Reply',
          output_type: 'variable',
          output_variable: 'summary_1.text',
          reference_key: 'answer_1',
        },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-input',
        target: 'node-parallel',
        type: 'smoothstep',
      },
      {
        id: 'edge-2',
        source: 'node-parallel',
        target: 'node-tool-1',
        type: 'smoothstep',
      },
      {
        id: 'edge-3',
        source: 'node-parallel',
        target: 'node-tool-2',
        type: 'smoothstep',
      },
      {
        id: 'edge-4',
        source: 'node-parallel',
        target: 'node-tool-3',
        type: 'smoothstep',
      },
      {
        id: 'edge-5',
        source: 'node-tool-1',
        target: 'node-llm-summary',
        type: 'smoothstep',
      },
      {
        id: 'edge-6',
        source: 'node-tool-2',
        target: 'node-llm-summary',
        type: 'smoothstep',
      },
      {
        id: 'edge-7',
        source: 'node-tool-3',
        target: 'node-llm-summary',
        type: 'smoothstep',
      },
      {
        id: 'edge-8',
        source: 'node-llm-summary',
        target: 'node-answer',
        type: 'smoothstep',
      },
    ],
  }
};

/**
 * Simple greeting workflow (draft)
 */
export const simpleGreetingWorkflow: Workflow = {
  id: 'wf-003',
  name: 'Simple Greeting Flow',
  description: 'A simple automatic greeting reply flow',
  status: 'draft',
  version: 1,
  tags: ['Simple', 'Greeting'],
  created_at: '2024-01-28T11:00:00Z',
  updated_at: '2024-01-28T11:00:00Z',
  definition: {
    nodes: [
      {
        id: 'node-input',
        type: 'input',
        position: { x: 250, y: 50 },
        data: {
          type: 'input',
          label: 'User Input',
          input_variables: [{ name: 'query', type: 'string', description: 'Message content entered by the user' }],
          reference_key: 'input_1',
        },
      },
      {
        id: 'node-llm',
        type: 'llm',
        position: { x: 250, y: 150 },
        data: {
          type: 'llm',
          label: 'Generate Greeting',
          user_prompt: 'Generate a friendly reply to the user\'s greeting: {{input_1.query}}',
          reference_key: 'llm_1',
        },
      },
      {
        id: 'node-answer',
        type: 'answer',
        position: { x: 250, y: 280 },
        data: {
          type: 'answer',
          label: 'Reply',
          output_type: 'variable',
          output_variable: 'llm_1.text',
          reference_key: 'answer_1',
        },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-input',
        target: 'node-llm',
        type: 'smoothstep',
      },
      {
        id: 'edge-2',
        source: 'node-llm',
        target: 'node-answer',
        type: 'smoothstep',
      },
    ],
  }
};

/**
 * All mock workflows
 */
export const mockWorkflows: Workflow[] = [
  customerServiceWorkflow,
  dataProcessingWorkflow,
  simpleGreetingWorkflow,
];

/**
 * Get workflow summaries from full workflows
 */
export function getWorkflowSummaries(): WorkflowSummary[] {
  return mockWorkflows.map(workflow => ({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    version: workflow.version,
    tags: workflow.tags,
    updated_at: workflow.updated_at,
  }));
}

/**
 * Get a workflow by ID
 */
export function getMockWorkflowById(id: string): Workflow | undefined {
  return mockWorkflows.find(wf => wf.id === id);
}

/**
 * Generate a new workflow ID
 */
export function generateWorkflowId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create an empty workflow template
 */
export function createEmptyWorkflow(name: string = 'New Workflow'): Workflow {
  const now = new Date().toISOString();
  return {
    id: generateWorkflowId(),
    name,
    description: '',
    status: 'draft',
    version: 1,
    tags: [],
    created_at: now,
    updated_at: now,
    definition: {
      nodes: [
        {
          id: 'node-input',
          type: 'input',
          position: { x: 250, y: 50 },
          data: {
            type: 'input',
            label: 'User Input',
            input_variables: [{ name: 'query', type: 'string', description: 'Message content entered by the user' }],
            reference_key: 'input_1',
          },
        },
        {
          id: 'node-answer',
          type: 'answer',
          position: { x: 250, y: 200 },
          data: {
            type: 'answer',
            label: 'Reply',
            output_type: 'template',
            output_template: '',
            reference_key: 'answer_1',
          },
        },
      ],
      edges: [
        {
          id: 'edge-input-answer',
          source: 'node-input',
          target: 'node-answer',
          type: 'smoothstep',
        },
      ],
    }
  };
}
