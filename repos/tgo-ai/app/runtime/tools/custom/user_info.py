"""Agent-level tool to collect and update user information."""

from __future__ import annotations

from typing import Any, Optional

import json

import httpx
from agno.tools import Function

from .base import DEFAULT_TIMEOUT, EventClient, ToolContext

# Fields that can be updated for user info
USER_INFO_FIELDS = (
    "email", "wechat", "phone", "name", "sex",
    "age", "company", "position", "address", "birthday",
)


def create_user_info_tool(
    *,
    agent_id: str,
    session_id: str | None,
    user_id: str | None,
    project_id: str | None = None,
    request_id: str | None = None,
) -> list[Function]:
    """Create a list of tools for managing user information."""
    ctx = ToolContext(agent_id, session_id, user_id, project_id, request_id)
    client = EventClient(ctx)

    error_messages = {
        "not_configured": "Sorry, user information cannot be processed right now. We have logged the issue and will handle it soon. Please try again later or contact support directly.",
        "api_error": "Sorry, the request failed. Please try again later or contact technical support.",
        "http_error": "Sorry, a network error occurred. Please try again later or contact technical support.",
        "unexpected_error": "Sorry, something went wrong. Please try again later or contact technical support.",
    }

    async def get_user_info() -> str:
        """Get the current user's detailed profile, including basic info, tags, AI profile and recent activity."""
        if not client.is_configured:
            return error_messages["not_configured"]

        user_id = ctx.user_id
        if not user_id:
            return "Unable to determine the current user ID. Please make sure the user has been initialized."

        if not ctx.project_id:
            return "Configuration error: project ID not provided."

        internal_base_url = client.internal_base_url
        if not internal_base_url:
            return error_messages["not_configured"]

        url = f"{internal_base_url.rstrip('/')}/internal/users/{user_id}"
        params = {"project_id": ctx.project_id}

        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as http_client:
                resp = await http_client.get(url, params=params)
                if resp.status_code == 404:
                    return f"No profile found for user (ID: {user_id})."
                resp.raise_for_status()
                data = resp.json()
                return json.dumps(data, ensure_ascii=False, indent=2)
        except httpx.HTTPError as exc:
            return f"{error_messages['http_error']} (Detail: {str(exc)})"
        except Exception as exc:
            return f"{error_messages['unexpected_error']} (Detail: {str(exc)})"

    async def update_user_info(
        *,
        email: Optional[str] = None,
        wechat: Optional[str] = None,
        phone: Optional[str] = None,
        name: Optional[str] = None,
        sex: Optional[str] = None,
        age: Optional[str] = None,
        company: Optional[str] = None,
        position: Optional[str] = None,
        address: Optional[str] = None,
        birthday: Optional[str] = None,
        extra_info: Optional[dict[str, Any]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Update user information via user_info.update event."""
        # Collect provided fields

        local_vars = locals()
        provided = {k: local_vars[k] for k in USER_INFO_FIELDS if local_vars.get(k) not in (None, "")}

        if not provided:
            return "Please provide at least one user info field to update, such as email, phone, WeChat or name."

        # Build user data
        user_data = dict(provided)
        if extra_info:
            user_data["extra_info"] = extra_info

        result = await client.post_event(
            "user_info.update",
            {"visitor": user_data, "metadata": metadata},
            error_messages=error_messages,
        )

        if not result.success:
            return result.message

        updated_keys = ", ".join(provided.keys())
        return f"User info update submitted: {updated_keys}. Thank you for your cooperation!"

    return [
        Function(
            name="get_user_info",
            description="Get the current user's detailed background profile, including name, contact details, company and position, tag profile, source channel and the 10 most recent activity records.",
            entrypoint=get_user_info,
        ),
        Function(
            name="update_user_info",
            description=(
                "Call this tool to record or update the user's profile when the user provides contact details. "
                "Information that can be collected includes: email, WeChat, phone, name, gender, company, position, address, birthday, notes, etc.; "
                "all fields are optional and partial updates are supported."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "email": {"type": "string", "description": "Email (optional)"},
                    "wechat": {"type": "string", "description": "WeChat ID (optional)"},
                    "phone": {"type": "string", "description": "Phone number (optional)"},
                    "name": {"type": "string", "description": "Name (optional)"},
                    "sex": {"type": "string", "description": "Gender (optional)"},
                    "age": {"type": "string", "description": "Age (optional)"},
                    "company": {"type": "string", "description": "Company (optional)"},
                    "position": {"type": "string", "description": "Job title (optional)"},
                    "address": {"type": "string", "description": "Address (optional)"},
                    "birthday": {"type": "string", "description": "Birthday (optional)"},
                    "extra_info": {"type": "object", "description": "Extended info: stores other user info not predefined, such as Telegram, preferences, etc. (optional)"},
                    "metadata": {"type": "object", "description": "Other context fields (optional)"},
                },
                "required": [],
            },
            entrypoint=update_user_info,
            skip_entrypoint_processing=True,
        ),
    ]
