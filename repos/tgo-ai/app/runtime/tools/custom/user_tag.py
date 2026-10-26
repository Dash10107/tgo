"""Agent-level tool to add tags to users."""

from __future__ import annotations

from typing import Any, Optional

from agno.tools import Function

from .base import EventClient, ToolContext


def create_user_tag_tool(
    *,
    agent_id: str,
    session_id: str | None,
    user_id: str | None,
    project_id: str | None = None,
    request_id: str | None = None,
) -> Function:
    """Create an agent-level tool that adds tags to users."""
    ctx = ToolContext(agent_id, session_id, user_id, project_id, request_id)
    client = EventClient(ctx)

    error_messages = {
        "not_configured": "Sorry, a tag cannot be added to the user right now. We have logged the issue and will handle it soon. Please try again later or contact support directly.",
        "api_error": "Sorry, the user tag could not be submitted. Please try again later or contact technical support.",
        "http_error": "Sorry, a network error prevented the user tag from being submitted. Please try again later or contact technical support.",
        "unexpected_error": "Sorry, something went wrong and a tag cannot be added to the user right now. Please try again later or contact technical support.",
    }

    async def add_user_tags(
        *,
        tags: list[dict[str, str]],
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Add tags to user via user_tag.add event.

        Args:
            tags: List of tag objects, each with 'name' (English, required) and 'name_zh' (Chinese, optional)
            metadata: Optional additional context
        """
        if not tags:
            return "Please provide at least one tag."

        # Validate and normalize tags
        normalized_tags = []
        for tag in tags:
            if not isinstance(tag, dict):
                return "Invalid tag format; each tag must contain a name field."

            name = tag.get("name", "").strip()
            if not name:
                return "The tag's name field must not be empty."

            normalized_tag = {"name": name}
            name_zh = tag.get("name_zh", "").strip()
            if name_zh:
                normalized_tag["name_zh"] = name_zh

            normalized_tags.append(normalized_tag)

        result = await client.post_event(
            "user_tag.add",
            {"tags": normalized_tags, "metadata": metadata or {"source": "ai_analysis"}},
            error_messages=error_messages,
        )

        if not result.success:
            return result.message

        tag_names = ", ".join(t["name"] for t in normalized_tags)
        return f"Tags added to the user: {tag_names}."

    return Function(
        name="add_user_tags",
        description=(
            "Call this tool to add tags to the user when you identify that the user has certain characteristics or belongs to a category. "
            "Tags are used for user classification and follow-up marketing/service strategies. "
            "Common tag examples: VIP (important customer), High Intent, Price Sensitive, "
            "Tech Support, New User, Returning (returning customer), etc."
        ),
        parameters={
            "type": "object",
            "properties": {
                "tags": {
                    "type": "array",
                    "description": "List of tags; each tag contains name (English name, required) and name_zh (Chinese name, recommended)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Tag English name (required)"},
                            "name_zh": {"type": "string", "description": "Tag Chinese name (recommended)"},
                        },
                        "required": ["name"],
                    },
                },
                "metadata": {"type": "object", "description": "Other context fields (optional)"},
            },
            "required": ["tags"],
        },
        entrypoint=add_user_tags,
        skip_entrypoint_processing=True,
    )
