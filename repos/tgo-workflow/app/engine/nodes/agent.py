from typing import Any, Dict, Optional, Tuple
from app.engine.nodes.base import BaseNodeExecutor
from app.engine.context import ExecutionContext
from app.engine.nodes.registry import register_node
from app.integrations.ai_client import AIClient
from app.core.logging import logger

@register_node("agent")
class AgentNodeExecutor(BaseNodeExecutor):
    # Agent runs can take longer than the default node timeout
    DEFAULT_TIMEOUT = 120

    async def execute(self, context: ExecutionContext) -> Tuple[Dict[str, Any], Optional[str]]:
        agent_id = self.config.get("agent_id")
        input_mapping = self.config.get("input_mapping") or {}

        # Resolve inputs using mapping
        resolved_inputs = {}
        for key, template in input_mapping.items():
            resolved_inputs[key] = context.resolve_variables(template)

        # AI service /api/v1/agents/run expects:
        # { "agent_id": "...", "message": "...", "stream": false } (extra fields are rejected)

        message = resolved_inputs.get("message")
        if not message:
            # No explicit message mapping: forward the workflow trigger inputs
            trigger_inputs = {k: v for k, v in context.get_trigger_inputs().items() if v not in (None, "")}
            if len(trigger_inputs) == 1:
                message = next(iter(trigger_inputs.values()))
            else:
                message = "\n".join(f"{k}: {v}" for k, v in trigger_inputs.items())
        message = str(message).strip() if message is not None else ""
        if not message:
            raise ValueError("Agent node has no message to send; map a 'message' input or provide workflow inputs")

        payload = {
            "message": message,
            "stream": False
        }
        # Empty agent_id lets the AI service fall back to the project default agent
        if agent_id:
            payload["agent_id"] = agent_id

        # Merge other inputs into payload if needed, or session_id
        if resolved_inputs.get("session_id"):
            payload["session_id"] = str(resolved_inputs["session_id"])

        active_project_id = context.project_id or "00000000-0000-0000-0000-000000000000"

        try:
            data = await AIClient.run_agent(active_project_id, payload)
        except Exception as e:
            logger.error(f"Agent execution failed: {e}")
            raise

        # SupervisorRunResponse: success, content, error
        if not data.get("success", True):
            raise RuntimeError(data.get("error") or data.get("message") or "Agent run failed")
        return {"text": data.get("content", "")}, None
