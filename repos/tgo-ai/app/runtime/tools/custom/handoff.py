"""Agent-level human handoff tool for requesting human support."""

from __future__ import annotations

from typing import Any, Optional

from agno.tools import Function

from .base import EventClient, ToolContext


def create_handoff_tool(
    *,
    agent_id: str,
    session_id: str | None,
    user_id: str | None,
    project_id: str | None = None,
    request_id: str | None = None,
) -> Function:
    """Create an agent-level tool that requests human support."""
    ctx = ToolContext(agent_id, session_id, user_id, project_id, request_id)
    client = EventClient(ctx)

    error_messages = {
        "not_configured": "Sorry, a human service request cannot be started right now. We have logged the issue and will handle it soon. Please try again later or contact support directly.",
        "api_error": "Sorry, the human service request could not be submitted. Please try again later or contact technical support.",
        "http_error": "Sorry, a network error prevented the human service request from being submitted. Please try again later or contact technical support.",
        "unexpected_error": "Sorry, something went wrong and a human service request cannot be started right now. Please try again later or contact technical support.",
    }

    async def request_human_support(
        *,
        reason: str,
        urgency: str = "normal",
        channel: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Request human support via manual_service.request event."""
        result = await client.post_event(
            "manual_service.request",
            {"reason": reason, "urgency": urgency, "channel": channel, "metadata": metadata},
            error_messages=error_messages,
        )

        if not result.success:
            return result.message

        return (
            f"[handoff_requested] agent={agent_id} session={session_id or ''} "
            f"urgency={urgency} reason={reason} (event sent)"
        )

    return Function(
        name="request_human_support",
        description=(
            "Call this tool when the user explicitly asks for a human or you judge that human intervention is needed, to start the human support flow. "
            "Briefly state the reason and the urgency in the parameters."
        ),
        parameters={
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Reason for triggering human intervention (required)"},
                "urgency": {"type": "string", "description": "Urgency: low|normal|high|urgent (default normal)"},
                "channel": {"type": "string", "description": "Preferred human channel (e.g. phone/wechat/email/ticket; optional)"},
                "metadata": {"type": "object", "description": "Other context fields (optional)"},
            },
            "required": ["reason"],
        },
        entrypoint=request_human_support,
        skip_entrypoint_processing=True,
    )
