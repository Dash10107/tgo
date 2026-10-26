/**
 * Built-in Workflow Templates
 * Ready-to-run workflow graphs users can create with one click and then adjust
 */

import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
  WorkflowTemplate,
  WorkflowTemplateId,
  WorkflowTemplateModel,
} from '@/types/workflow';

const node = (
  id: string,
  type: WorkflowNodeType,
  x: number,
  y: number,
  data: WorkflowNodeData,
): WorkflowNode => ({
  id,
  type,
  position: { x, y },
  data: { ...data, reference_key: id },
});

const edge = (source: string, target: string, sourceHandle?: string): WorkflowEdge => ({
  id: sourceHandle ? `e-${source}-${sourceHandle}-${target}` : `e-${source}-${target}`,
  source,
  target,
  sourceHandle: sourceHandle ?? null,
  type: 'smoothstep',
});

const SUPPORT_BASE_PROMPT =
  'You are a friendly, professional customer support assistant. Reply in the same language the customer used. ' +
  'Keep replies concise (under 120 words). Never invent order numbers, prices, policies or account details, ' +
  'and ask for any information you need that is missing.';

const supportReply = (id: string, x: number, label: string, focus: string): WorkflowNode =>
  node(id, 'llm', x, 380, {
    type: 'llm',
    label,
    system_prompt: `${SUPPORT_BASE_PROMPT}\n\n${focus}`,
    user_prompt: '{{input_1.query}}',
    temperature: 0.5,
    max_tokens: 800,
    tool_ids: [],
    collection_ids: [],
  });

const supportAnswer = (id: string, x: number, replyKey: string): WorkflowNode =>
  node(id, 'answer', x, 620, {
    type: 'answer',
    label: 'workflow.templates.nodes.return_reply',
    output_type: 'structured',
    output_structure: [
      { key: 'topic', value: '{{classifier_1.category_id}}' },
      { key: 'reply', value: `{{${replyKey}.text}}` },
    ],
  });

/**
 * Customer Support Triage: classify the topic, then draft a topic-specific reply
 */
const SUPPORT_TRIAGE: WorkflowTemplate = {
  id: 'support_triage',
  name: 'workflow.templates.support_triage.name',
  description: 'workflow.templates.support_triage.description',
  tags: ['template', 'support'],
  nodes: [
    node('input_1', 'input', 450, 0, {
      type: 'input',
      label: 'workflow.templates.nodes.customer_message',
      input_variables: [{ name: 'query', type: 'string', description: "The customer's message" }],
    }),
    node('classifier_1', 'classifier', 420, 150, {
      type: 'classifier',
      label: 'workflow.templates.nodes.detect_topic',
      input_variable: '{{input_1.query}}',
      categories: [
        { id: 'general', name: 'General Inquiry', description: 'Greetings, product questions, feedback or anything that fits no other category' },
        { id: 'order', name: 'Orders & Shipping', description: 'Order status, delivery, shipping, returns, exchanges and refunds' },
        { id: 'billing', name: 'Billing & Payments', description: 'Charges, invoices, payment methods, subscriptions, plans and pricing' },
        { id: 'technical', name: 'Technical Support', description: 'Bugs, error messages, login or account access problems, how to use the product' },
      ],
    }),
    supportReply('llm_1', 0, 'workflow.templates.nodes.general_reply',
      'Answer general questions and product inquiries helpfully. If the request needs account access or a human decision, say a teammate will follow up.'),
    supportReply('llm_2', 320, 'workflow.templates.nodes.order_reply',
      'Topic: orders, shipping, delivery, returns and refunds. If no order number is given, ask for it together with the email used at checkout. Explain the next step clearly.'),
    supportReply('llm_3', 640, 'workflow.templates.nodes.billing_reply',
      'Topic: billing, charges, invoices, payment methods, subscriptions and pricing. Never ask for full card numbers or passwords. For disputed or duplicate charges, acknowledge the issue, ask for the transaction date and amount, and say the billing team will review it.'),
    supportReply('llm_4', 960, 'workflow.templates.nodes.technical_reply',
      'Topic: technical problems, errors, login issues and how-to questions. If missing, ask for the device or browser, the exact error message and the steps that led to it, then suggest the most likely fixes as a short numbered list.'),
    supportAnswer('answer_1', 20, 'llm_1'),
    supportAnswer('answer_2', 340, 'llm_2'),
    supportAnswer('answer_3', 660, 'llm_3'),
    supportAnswer('answer_4', 980, 'llm_4'),
  ],
  edges: [
    edge('input_1', 'classifier_1'),
    edge('classifier_1', 'llm_1', 'general'),
    edge('classifier_1', 'llm_2', 'order'),
    edge('classifier_1', 'llm_3', 'billing'),
    edge('classifier_1', 'llm_4', 'technical'),
    edge('llm_1', 'answer_1'),
    edge('llm_2', 'answer_2'),
    edge('llm_3', 'answer_3'),
    edge('llm_4', 'answer_4'),
  ],
};

const leadAnswer = (id: string, x: number, score: string, nextStep: string): WorkflowNode =>
  node(id, 'answer', x, 600, {
    type: 'answer',
    label: 'workflow.templates.nodes.return_lead',
    output_type: 'structured',
    output_structure: [
      { key: 'lead_score', value: score },
      { key: 'details', value: '{{llm_1.text}}' },
      { key: 'next_step', value: nextStep },
    ],
  });

/**
 * Lead Qualification: extract lead details, then score the lead as hot / warm / cold
 */
const LEAD_QUALIFICATION: WorkflowTemplate = {
  id: 'lead_qualification',
  name: 'workflow.templates.lead_qualification.name',
  description: 'workflow.templates.lead_qualification.description',
  tags: ['template', 'sales'],
  nodes: [
    node('input_1', 'input', 340, 0, {
      type: 'input',
      label: 'workflow.templates.nodes.prospect_message',
      input_variables: [{ name: 'message', type: 'string', description: "The prospect's message or a summary of the conversation" }],
    }),
    node('llm_1', 'llm', 300, 150, {
      type: 'llm',
      label: 'workflow.templates.nodes.extract_details',
      system_prompt:
        'You are a sales development assistant. Extract lead information from the prospect\'s message. ' +
        'Use only what is stated and write "Unknown" for anything not mentioned. Do not add commentary.',
      user_prompt:
        'Prospect message:\n{{input_1.message}}\n\nReturn exactly these lines:\n' +
        'Name: \nCompany: \nContact: \nNeed: \nBudget: \nTimeline: \nSummary: <one sentence describing what they want>',
      temperature: 0.2,
      max_tokens: 500,
      tool_ids: [],
      collection_ids: [],
    }),
    node('classifier_1', 'classifier', 310, 360, {
      type: 'classifier',
      label: 'workflow.templates.nodes.score_lead',
      input_variable: '{{llm_1.text}}',
      categories: [
        { id: 'cold', name: 'Cold Lead', description: 'Just browsing or researching; no clear need, budget or timeline' },
        { id: 'warm', name: 'Warm Lead', description: 'Real need or interest, but budget, decision maker or timeline is unclear or months away' },
        { id: 'hot', name: 'Hot Lead', description: 'Clear need plus budget or a near-term timeline; asks for pricing, a demo, a quote or to buy now' },
      ],
    }),
    leadAnswer('answer_1', 0, 'cold',
      'Share helpful resources and add them to the nurture list; no sales follow-up needed yet.'),
    leadAnswer('answer_2', 320, 'warm',
      'Answer their open questions, share pricing or case studies, and schedule a follow-up.'),
    leadAnswer('answer_3', 640, 'hot',
      'Hand this lead to a sales rep right away and offer a call or demo.'),
  ],
  edges: [
    edge('input_1', 'llm_1'),
    edge('llm_1', 'classifier_1'),
    edge('classifier_1', 'answer_1', 'cold'),
    edge('classifier_1', 'answer_2', 'warm'),
    edge('classifier_1', 'answer_3', 'hot'),
  ],
};

/**
 * Agent Reply with Escalation: upset customers get an empathetic hand-off reply,
 * everything else is answered by the selected AI agent
 */
const AGENT_ESCALATION: WorkflowTemplate = {
  id: 'agent_escalation',
  name: 'workflow.templates.agent_escalation.name',
  description: 'workflow.templates.agent_escalation.description',
  tags: ['template', 'support', 'agent'],
  nodes: [
    node('input_1', 'input', 340, 0, {
      type: 'input',
      label: 'workflow.templates.nodes.customer_message',
      input_variables: [{ name: 'query', type: 'string', description: "The customer's message" }],
    }),
    node('classifier_1', 'classifier', 310, 150, {
      type: 'classifier',
      label: 'workflow.templates.nodes.check_sentiment',
      input_variable: '{{input_1.query}}',
      categories: [
        { id: 'normal', name: 'Normal Request', description: 'Routine question or request in a calm, neutral or positive tone' },
        { id: 'escalate', name: 'Needs Escalation', description: 'Angry or very frustrated, threatens to cancel or take legal action, reports an urgent or safety issue, or explicitly asks for a human' },
      ],
    }),
    node('agent_1', 'agent', 0, 380, {
      type: 'agent',
      label: 'workflow.templates.nodes.agent_answer',
      agent_id: '',
      agent_name: '',
      input_mapping: { message: '{{input_1.query}}' },
    }),
    node('llm_1', 'llm', 620, 380, {
      type: 'llm',
      label: 'workflow.templates.nodes.empathetic_reply',
      system_prompt: 'You are a calm, empathetic senior customer support lead. Reply in the same language the customer used.',
      user_prompt:
        'Customer message:\n{{input_1.query}}\n\n' +
        'Write a short reply (2-4 sentences) that acknowledges how they feel, apologizes for the trouble, and tells them ' +
        'a human teammate has been notified and will follow up shortly. Do not promise refunds, compensation or specific outcomes.',
      temperature: 0.4,
      max_tokens: 400,
      tool_ids: [],
      collection_ids: [],
    }),
    node('answer_1', 'answer', 10, 600, {
      type: 'answer',
      label: 'workflow.templates.nodes.return_reply',
      output_type: 'structured',
      output_structure: [
        { key: 'escalate', value: 'false' },
        { key: 'reply', value: '{{agent_1.text}}' },
      ],
    }),
    node('answer_2', 'answer', 640, 600, {
      type: 'answer',
      label: 'workflow.templates.nodes.return_escalation',
      output_type: 'structured',
      output_structure: [
        { key: 'escalate', value: 'true' },
        { key: 'reply', value: '{{llm_1.text}}' },
      ],
    }),
  ],
  edges: [
    edge('input_1', 'classifier_1'),
    edge('classifier_1', 'agent_1', 'normal'),
    edge('classifier_1', 'llm_1', 'escalate'),
    edge('agent_1', 'answer_1'),
    edge('llm_1', 'answer_2'),
  ],
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [SUPPORT_TRIAGE, LEAD_QUALIFICATION, AGENT_ESCALATION];

export const getWorkflowTemplate = (id: WorkflowTemplateId): WorkflowTemplate | undefined =>
  WORKFLOW_TEMPLATES.find(template => template.id === id);

/**
 * Build a fresh copy of a template's graph: labels translated, and AI nodes without
 * a model assigned the given default model.
 */
export const buildTemplateGraph = (
  template: WorkflowTemplate,
  translate: (key: string) => string,
  model: WorkflowTemplateModel | null,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
  const nodes = template.nodes.map((templateNode): WorkflowNode => {
    const data: WorkflowNodeData = structuredClone(templateNode.data);
    data.label = translate(data.label);
    if (model && (data.type === 'llm' || data.type === 'classifier') && !data.provider_id) {
      data.provider_id = model.provider_id;
      data.model_id = model.model_id;
      data.model_name = model.model_name;
    }
    return { ...templateNode, position: { ...templateNode.position }, data };
  });
  const edges = template.edges.map((templateEdge): WorkflowEdge => ({ ...templateEdge }));
  return { nodes, edges };
};
