from __future__ import annotations

from types import ModuleType, SimpleNamespace
import importlib
import sys
import unittest
from unittest.mock import patch


class _Function:
    def __init__(self, **kwargs: object) -> None:
        self.__dict__.update(kwargs)


agno_module = ModuleType("agno")
agno_tools_module = ModuleType("agno.tools")
agno_tools_module.Function = _Function
agno_module.tools = agno_tools_module
sys.modules.setdefault("agno", agno_module)
sys.modules.setdefault("agno.tools", agno_tools_module)

user_info_module = importlib.import_module("app.runtime.tools.custom.user_info")


class _FakeEventClient:
    last_call: dict[str, object] | None = None

    def __init__(self, ctx: object) -> None:
        self.ctx = ctx
        self.is_configured = True
        self.internal_base_url = "http://tgo-api:8001"

    async def post_event(
        self,
        event_type: str,
        payload: dict[str, object],
        *,
        error_messages: dict[str, str],
    ) -> SimpleNamespace:
        _FakeEventClient.last_call = {
            "event_type": event_type,
            "payload": payload,
            "error_messages": error_messages,
        }
        return SimpleNamespace(success=True, message="")


class UserInfoToolTests(unittest.IsolatedAsyncioTestCase):
    async def test_update_user_info_sends_visitor_payload(self) -> None:
        _FakeEventClient.last_call = None

        with patch.object(user_info_module, "EventClient", _FakeEventClient):
            tools = user_info_module.create_user_info_tool(
                agent_id="agent-1",
                session_id="channel-1@251",
                user_id="visitor-1",
                project_id="project-1",
            )

            result = await tools[1].entrypoint(name="tt")

        self.assertEqual(result, "User info update submitted: name. Thank you for your cooperation!")
        self.assertIsNotNone(_FakeEventClient.last_call)
        self.assertEqual(
            _FakeEventClient.last_call,
            {
                "event_type": "user_info.update",
                "payload": {
                    "visitor": {"name": "tt"},
                    "metadata": None,
                },
                "error_messages": {
                    "not_configured": "Sorry, user information cannot be processed right now. We have logged the issue and will handle it soon. Please try again later or contact support directly.",
                    "api_error": "Sorry, the request failed. Please try again later or contact technical support.",
                    "http_error": "Sorry, a network error occurred. Please try again later or contact technical support.",
                    "unexpected_error": "Sorry, something went wrong. Please try again later or contact technical support.",
                },
            },
        )
