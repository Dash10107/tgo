"""Agent-level tool to track/update user sentiment/state information."""

from __future__ import annotations

from typing import Any, Optional

from agno.tools import Function

from .base import EventClient, ToolContext


def _parse_scale(val: Any) -> int:
    """Parse and validate a 0-5 scale value.

    Raises:
        ValueError: If value is not a valid integer in range 0-5
    """
    s = str(val).strip()
    try:
        iv = int(s)
    except ValueError:
        # Try parsing as float and converting
        f = float(s)
        if not f.is_integer():
            raise ValueError("Not an integer")
        iv = int(f)

    if not 0 <= iv <= 5:
        raise ValueError("Value out of range 0-5")
    return iv


def create_user_sentiment_tool(
    *,
    agent_id: str,
    session_id: str | None,
    user_id: str | None,
    project_id: str | None = None,
    request_id: str | None = None,
) -> Function:
    """Create an agent-level tool that updates user sentiment/state."""
    ctx = ToolContext(agent_id, session_id, user_id, project_id, request_id)
    client = EventClient(ctx)

    error_messages = {
        "not_configured": "Sorry, the user status cannot be updated right now. We have logged the issue and will handle it soon. Please try again later or contact support directly.",
        "api_error": "Sorry, the user status update could not be submitted. Please try again later or contact technical support.",
        "http_error": "Sorry, a network error prevented the user status update from being submitted. Please try again later or contact technical support.",
        "unexpected_error": "Sorry, something went wrong and the user status cannot be updated right now. Please try again later or contact technical support.",
    }

    async def update_user_sentiment(
        *,
        satisfaction: Optional[str] = None,
        emotion: Optional[str] = None,
        intent: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Update user sentiment/state via user_sentiment.update event."""
        # Parse and validate scale values
        provided: dict[str, Any] = {}

        if satisfaction not in (None, ""):
            try:
                provided["satisfaction"] = _parse_scale(satisfaction)
            except (ValueError, TypeError):
                return "Satisfaction and emotion values must be between 0 and 5, where 0 means unknown."

        if emotion not in (None, ""):
            try:
                provided["emotion"] = _parse_scale(emotion)
            except (ValueError, TypeError):
                return "Satisfaction and emotion values must be between 0 and 5, where 0 means unknown."

        if intent not in (None, ""):
            provided["intent"] = intent

        if not provided:
            return "Please provide at least one user status field to update, such as satisfaction, emotion or intent."

        result = await client.post_event(
            "user_sentiment.update",
            {"sentiment": provided, "metadata": metadata},
            error_messages=error_messages,
        )

        if not result.success:
            return result.message

        updated_keys = ", ".join(provided.keys())
        return f"User status update recorded: {updated_keys}."

    return Function(
        name="update_user_sentiment",
        description=(
            "Call this tool to record/update the user's status when you detect a change in the user's satisfaction, emotion or intent during the conversation. "
            "Trackable information includes: satisfaction (0-5, 0 means unknown, higher is more satisfied), emotion (0-5, 0 means unknown, higher is more positive), "
            "and intent (e.g. purchase/inquiry/complaint/support); all fields are optional and partial updates are supported."
        ),
        parameters={
            "type": "object",
            "properties": {
                "satisfaction": {"type": "integer", "minimum": 0, "maximum": 5, "description": "Satisfaction, 0-5 (0=unknown, 1=very dissatisfied, 5=very satisfied)"},
                "emotion": {"type": "integer", "minimum": 0, "maximum": 5, "description": "Emotion, 0-5 (0=unknown, 1=very negative, 5=very positive)"},
                "intent": {"type": "string", "description": "Intent (optional)"},
                "metadata": {"type": "object", "description": "Other context fields (optional)"},
            },
            "required": [],
        },
        entrypoint=update_user_sentiment,
        skip_entrypoint_processing=True,
    )
