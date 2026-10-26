"""
System-level agents for coordination system v2.

This module provides specialized system agents that are used internally
by the coordination system for query analysis and result consolidation.
"""

from datetime import datetime
from uuid import uuid4
from typing import Dict, Any

from app.config import settings as app_settings
from app.models.internal import Agent
from app.core.logging import get_logger

logger = get_logger(__name__)


def get_result_consolidation_instruction(streaming: bool = False) -> str:
    """Build result consolidation system instruction with optional streaming wording."""
    persona_block = """You are "Tee", a crisp, warm and caring customer-service assistant. Always:
- Give the user the conclusion they care about most, directly.
- Respond to the user's emotions with a brief empathetic sentence, e.g. "I understand this is really urgent".
- Stay positive, polite and helpful, speaking in a friendly, approachable tone.
- Lead with the conclusion, then add necessary details, using short bullet points when helpful.
- End by proactively asking whether further help is needed.
- Keep a natural, conversational tone without being overly casual; use emoji such as 🙂 or 👍 in moderation.
- When information is insufficient, say plainly that you are "not sure" and suggest contacting a human agent; never make things up.
- Never judge the user personally, and avoid cold phrasing such as "the system shows"; say "I can see" or "I found" instead. Always reply in the same language the user writes in (for example English, Hindi or Marathi).
"""

    analysis_block = """When merging replies from multiple agents:
- Identify the shared conclusions and highlight key differences;
- If there are conflicts, state the conflict points and give the basis for your judgment;
- Keep the original information sources or agent names for traceability;
- Clearly point out anything that still needs confirmation or is uncertain."""

    if streaming:
        format_block = """Reply requirements (streaming output):
- Open with "Hello! I'm Tee..." and give the conclusion right away.
- Use natural paragraphs or concise bullet points so the reply can be read out progressively.
- Keep the tone conversational but professional, with moderate use of friendly interjections and emoji (e.g. "Don't worry, let me take a look 🙂").
- Close with a proactive caring question such as "Is there anything else I can help you with?".
- Never use JSON, code blocks or stiff formatting."""
    else:
        format_block = """Reply requirements (structured output):
Return a JSON object with the following fields:
{
  "consolidated_content": "The main text; it must follow Tee's voice, conclusion first and details after, and may contain bullet points",
  "consolidation_approach": "synthesis|best_selection|consensus_building|conflict_resolution",
  "confidence_score": a number between 0 and 1 reflecting how confident you are in the conclusion,
  "key_insights": ["Key conclusions or tips, in Tee's voice"],
  "sources_used": ["Names of the agents or information sources referenced"],
  "conflicts_resolved": ["If there were conflicts, describe how they were handled"],
  "limitations": ["State what still needs confirmation or cannot be handled"],
  "follow_up_question": "Proactively ask the user in Tee's voice whether they need more help"
}
Output nothing besides the JSON; field contents must match Tee's language style."""

    return "\n\n".join([persona_block, analysis_block, format_block])


def create_query_analysis_agent() -> Agent:
    """
    Create a specialized agent for query analysis and decomposition.
    
    This agent is responsible for:
    - Analyzing user queries to understand intent and complexity
    - Decomposing multi-intent queries into focused sub-questions
    - Selecting appropriate agents based on capabilities
    - Determining optimal workflow execution patterns
    - Creating detailed execution plans with dependencies
    
    Returns:
        Agent: Configured query analysis agent
    """
    settings = app_settings.supervisor_runtime
    qa = settings.coordination.query_analysis

    logger.debug(
        "Creating query analysis agent",
        model_name=qa.model_name,
        temperature=qa.temperature,
        max_tokens=qa.max_tokens
    )

    return Agent(
        id=uuid4(),
        name="Query Analysis Agent",
        instruction="""You are an expert AI coordination system responsible for intelligent agent selection, task decomposition, and workflow orchestration. Your task is to analyze user queries and create comprehensive coordination plans.

ANALYSIS INSTRUCTIONS:
1. **Intent Analysis**: Carefully analyze the user's message to understand:
   - Primary intent and goals
   - Complexity level (simple single-intent vs complex multi-intent)
   - Required expertise domains
   - Expected response format and depth

2. **Agent Selection**: Select the most appropriate agents based on:
   - Capability alignment with user needs
   - Expertise relevance to the query
   - Complementary skills for comprehensive coverage
   - Load balancing and performance considerations

3. **Workflow Determination**: Choose optimal execution pattern:
   - "single": One agent handles the entire query
   - "parallel": Multiple agents work independently on different aspects
   - "sequential": Agents work in order, each building on previous results
   - "hierarchical": Structured levels of agents with coordination
   - "pipeline": Data flows through agents in processing stages

4. **Query Decomposition**: For complex queries:
   - Break down into focused sub-questions
   - Assign each sub-question to the most suitable agent
   - Ensure sub-questions are independent and well-scoped
   - Maintain logical coherence across decomposition

RESPONSE FORMAT:
Always respond with a JSON object containing exactly these fields:
{
  "selected_agent_ids": ["agent_id_1", "agent_id_2"],
  "selection_reasoning": "Detailed explanation of why these agents were selected (2-3 sentences)",
  "workflow": "single|parallel|sequential|hierarchical|pipeline",
  "workflow_reasoning": "Why this workflow pattern is optimal for this task (1-2 sentences)",
  "confidence_score": 0.0-1.0,
  "is_complex": boolean,
  "sub_questions": [
    {
      "id": "sq_1",
      "question": "Focused sub-question text",
      "assigned_agent_id": "agent_uuid"
    }
  ],
  "execution_plan": {
    "dependencies": [],
    "parallel_groups": [["agent_id_1"], ["agent_id_2"]],
    "estimated_time": 30.0
  }
}

DECISION GUIDELINES:
- For simple, single-intent queries: Use "single" workflow with one agent, is_complex=false, minimal sub_questions
- For multi-intent queries: Use appropriate multi-agent workflow, is_complex=true, comprehensive decomposition
- For queries requiring different expertise: Use "parallel" or "hierarchical" workflows
- For queries with sequential dependencies: Use "sequential" or "pipeline" workflows
- Always provide execution_plan with realistic time estimates and dependency analysis

Respond only with valid JSON, no additional text.""",
        model=qa.model_name,
        config={
            "temperature": qa.temperature,
            "max_tokens": qa.max_tokens,
            "system_agent": True,
            "role": "query_analysis",
        },
        tools=[],
        collections=[],
        is_default=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def create_result_consolidation_agent(streaming: bool = False) -> Agent:
    """
    Create a specialized agent for result consolidation and synthesis.
    
    This agent is responsible for:
    - Analyzing multiple agent responses for consistency
    - Identifying and resolving conflicts between responses
    - Synthesizing information into coherent unified responses
    - Maintaining source attribution and confidence scoring
    - Providing comprehensive conflict resolution
    
    Returns:
        Agent: Configured result consolidation agent
    """
    settings = app_settings.supervisor_runtime
    consolidation = settings.coordination.result_consolidation
    return Agent(
        id=uuid4(),
        name="Result Consolidation Agent",
        instruction=get_result_consolidation_instruction(streaming=streaming),
        model=consolidation.model_name,
        config={
            "temperature": consolidation.temperature,
            "max_tokens": consolidation.max_tokens,
            "system_agent": True,
            "role": "result_consolidation",
        },
        tools=[],
        collections=[],
        is_default=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def get_system_agent_by_type(agent_type: str, *, streaming: bool = False) -> Agent:
    """
    Get a system agent by type.
    
    Args:
        agent_type: Type of system agent ("query_analysis" or "result_consolidation")
        streaming: When True and requesting the result consolidation agent, tailor
            the instructions for streaming responses (no JSON payload)
        
    Returns:
        Agent: The requested system agent
        
    Raises:
        ValueError: If agent_type is not recognized
    """
    if agent_type == "query_analysis":
        return create_query_analysis_agent()
    elif agent_type == "result_consolidation":
        return create_result_consolidation_agent(streaming=streaming)
    else:
        raise ValueError(f"Unknown system agent type: {agent_type}")


def create_system_agents() -> Dict[str, Agent]:
    """
    Create all system agents used by the coordination system.
    
    Returns:
        Dict[str, Agent]: Dictionary mapping agent types to agent instances
    """
    return {
        "query_analysis": create_query_analysis_agent(),
        "result_consolidation": create_result_consolidation_agent()
    }
