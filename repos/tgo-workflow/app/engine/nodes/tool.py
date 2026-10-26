from typing import Any, Dict, Optional, Tuple
from app.engine.nodes.base import BaseNodeExecutor
from app.engine.context import ExecutionContext
from app.engine.nodes.registry import register_node
from app.integrations.ai_client import AIClient
from app.core.logging import logger

@register_node("tool")
class ToolNodeExecutor(BaseNodeExecutor):
    async def execute(self, context: ExecutionContext) -> Tuple[Dict[str, Any], Optional[str]]:
        tool_id = self.config.get("tool_id")
        if not tool_id:
            raise ValueError("Missing tool_id in node configuration")

        input_mapping = self.config.get("input_mapping") or {}
        
        # Resolve inputs using mapping
        resolved_inputs = {}
        for key, template in input_mapping.items():
            resolved_inputs[key] = context.resolve_variables(template)
            
        active_project_id = context.project_id or "00000000-0000-0000-0000-000000000000"
        
        logger.info(f"Executing tool {tool_id} for project {active_project_id}")
        try:
            execution_data = await AIClient.execute_tool(
                project_id=active_project_id,
                tool_id=tool_id,
                inputs=resolved_inputs
            )
        except Exception as e:
            logger.error(f"Failed to execute tool {tool_id}: {e}")
            raise RuntimeError(f"Tool execution failed: {str(e)}") from e

        # ToolExecuteResponse: success, result, error, execution_time
        if not execution_data.get("success", False):
            error_msg = execution_data.get("error") or "Tool execution failed without error message"
            logger.error(f"Tool {tool_id} execution failed: {error_msg}")
            raise RuntimeError(error_msg)

        return {"result": execution_data.get("result")}, None

