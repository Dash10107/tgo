"""Tests for single-agent chat streaming behavior."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

import app.services.ai_client as ai_client_module
import app.services.chat_service as chat_service


@pytest.mark.asyncio
async def test_forward_ai_event_to_wukongim_uses_agent_content_chunk(monkeypatch) -> None:
    """Agent chunk events should map to WuKongIM stream deltas."""

    sent_events: list[dict[str, object]] = []
    monkeypatch.setattr(
        chat_service.wukongim_client,
        "send_stream_event",
        AsyncMock(side_effect=lambda **kwargs: sent_events.append(kwargs)),
    )

    chunk = await chat_service.forward_ai_event_to_wukongim(
        event_type="agent_content_chunk",
        event_data={"data": {"content_chunk": "hello"}},
        channel_id="channel-1",
        channel_type=1,
        client_msg_no="msg-1",
        from_uid="agent-1-agent",
    )

    assert chunk == "hello"
    assert sent_events[0]["event_type"] == "stream.delta"


@pytest.mark.asyncio
async def test_forward_ai_event_to_wukongim_finishes_on_agent_response_complete(
    monkeypatch,
) -> None:
    """Agent completion events should close and finish the stream."""

    sent_events: list[dict[str, object]] = []
    monkeypatch.setattr(
        chat_service.wukongim_client,
        "send_stream_event",
        AsyncMock(side_effect=lambda **kwargs: sent_events.append(kwargs)),
    )

    await chat_service.forward_ai_event_to_wukongim(
        event_type="agent_response_complete",
        event_data={"data": {}},
        channel_id="channel-1",
        channel_type=1,
        client_msg_no="msg-1",
        from_uid="agent-1-agent",
    )

    assert [event["event_type"] for event in sent_events] == [
        "stream.close",
        "stream.finish",
    ]


@pytest.mark.asyncio
async def test_forward_ai_event_to_wukongim_reports_workflow_failed(monkeypatch) -> None:
    """Workflow failures should map to WuKongIM stream errors."""

    sent_events: list[dict[str, object]] = []
    monkeypatch.setattr(
        chat_service.wukongim_client,
        "send_stream_event",
        AsyncMock(side_effect=lambda **kwargs: sent_events.append(kwargs)),
    )

    await chat_service.forward_ai_event_to_wukongim(
        event_type="workflow_failed",
        event_data={"data": {"error": "boom"}},
        channel_id="channel-1",
        channel_type=1,
        client_msg_no="msg-1",
        from_uid="agent-1-agent",
    )

    assert sent_events[0]["event_type"] == "stream.error"


@pytest.mark.asyncio
async def test_run_background_ai_interaction_sets_started_event_on_agent_execution_started(
    monkeypatch,
) -> None:
    """Background AI runs should report startup on the new agent event."""

    async def fake_process(*_args, **_kwargs):
        yield {"event_type": "agent_execution_started", "data": {"run_id": "run-1"}}
        yield {"event_type": "workflow_completed", "data": {}}

    monkeypatch.setattr(chat_service, "process_ai_stream_to_wukongim", fake_process)

    started_event = asyncio.Event()

    await chat_service.run_background_ai_interaction(
        project_id="project-1",
        user_id="user-1",
        message="hello",
        channel_id="channel-1",
        channel_type=1,
        client_msg_no="msg-1",
        from_uid="agent-1-agent",
        session_id="session-1",
        agent_id="agent-1",
        started_event=started_event,
    )

    assert started_event.is_set()


@pytest.mark.asyncio
async def test_run_supervisor_agent_stream_omits_legacy_team_selectors(
    monkeypatch,
) -> None:
    """The downstream streaming payload should never include team selectors."""

    captured: dict[str, object] = {}

    class _FakeStreamResponse:
        status_code = 200

        async def __aenter__(self) -> "_FakeStreamResponse":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def aiter_lines(self):
            if False:
                yield ""

    class _FakeAsyncClient:
        def __init__(self, timeout=None) -> None:
            self.timeout = timeout

        async def __aenter__(self) -> "_FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        def stream(self, method: str, url: str, headers=None, json=None, params=None):
            captured["method"] = method
            captured["url"] = url
            captured["json"] = json
            captured["params"] = params
            return _FakeStreamResponse()

    monkeypatch.setattr(ai_client_module.httpx, "AsyncClient", _FakeAsyncClient)

    client = ai_client_module.AIServiceClient()
    events = [
        event
        async for event in client.run_supervisor_agent_stream(
            project_id="project-1",
            agent_id="agent-1",
            user_id="user-1",
            message="hello",
            session_id="session-1",
            enable_memory=True,
            system_message="system",
            expected_output="output",
        )
    ]

    assert events == []
    payload = captured["json"]
    assert payload["agent_id"] == "agent-1"
    assert "team_id" not in payload
    assert "agent_ids" not in payload
    assert "config" not in payload


def _stub_wukongim(monkeypatch) -> list[dict[str, object]]:
    """Record every WuKongIM stream call (anchor message + stream events) in order."""

    sent: list[dict[str, object]] = []
    monkeypatch.setattr(
        chat_service.wukongim_client,
        "send_stream_message",
        AsyncMock(side_effect=lambda **kwargs: sent.append({"event_type": "anchor", **kwargs})),
    )
    monkeypatch.setattr(
        chat_service.wukongim_client,
        "send_stream_event",
        AsyncMock(side_effect=lambda **kwargs: sent.append(kwargs)),
    )
    return sent


def _stub_ai_stream(monkeypatch, events: list[dict[str, object]]) -> None:
    async def fake_stream(**_kwargs):
        for event in events:
            yield str(event["event_type"]), event

    monkeypatch.setattr(chat_service.ai_client, "run_supervisor_agent_stream", fake_stream)


async def _run_process() -> list[dict[str, object]]:
    return [
        event
        async for event in chat_service.process_ai_stream_to_wukongim(
            project_id="project-1",
            user_id="user-1",
            message="hello",
            channel_id="channel-1",
            channel_type=1,
            client_msg_no="msg-1",
            from_uid="agent-1-agent",
        )
    ]


@pytest.mark.asyncio
async def test_process_ai_stream_sends_fallback_when_run_has_no_content(monkeypatch) -> None:
    """An empty AI run must still produce a reply instead of the thinking placeholder."""

    sent = _stub_wukongim(monkeypatch)
    _stub_ai_stream(
        monkeypatch,
        [
            {"event_type": "agent_execution_started", "data": {}},
            {"event_type": "agent_response_complete", "data": {"final_content": ""}},
            {"event_type": "workflow_completed", "data": {}},
        ],
    )

    events = await _run_process()

    assert [event["event_type"] for event in sent] == [
        "anchor",
        "stream.delta",
        "stream.close",
        "stream.finish",
    ]
    assert sent[1]["payload"] == {"kind": "text", "delta": chat_service.AI_FALLBACK_REPLY}
    chunk_events = [event for event in events if event["event_type"] == "agent_content_chunk"]
    assert len(chunk_events) == 1


@pytest.mark.asyncio
async def test_process_ai_stream_replaces_failure_without_content_with_fallback(
    monkeypatch,
) -> None:
    """A failed run with no content closes normally with the fallback reply."""

    sent = _stub_wukongim(monkeypatch)
    _stub_ai_stream(
        monkeypatch,
        [{"event_type": "workflow_failed", "data": {"error_message": "content filter"}}],
    )

    await _run_process()

    # No anchor arrived from upstream, so the fallback creates one before streaming
    assert [event["event_type"] for event in sent] == [
        "anchor",
        "stream.delta",
        "stream.close",
        "stream.finish",
    ]


@pytest.mark.asyncio
async def test_process_ai_stream_keeps_real_content_and_closes_once(monkeypatch) -> None:
    """Normal runs stream content untouched and close the stream a single time."""

    sent = _stub_wukongim(monkeypatch)
    _stub_ai_stream(
        monkeypatch,
        [
            {"event_type": "agent_execution_started", "data": {}},
            {"event_type": "agent_content_chunk", "data": {"content_chunk": "Hi there"}},
            {"event_type": "agent_response_complete", "data": {}},
            {"event_type": "workflow_completed", "data": {}},
        ],
    )

    await _run_process()

    assert [event["event_type"] for event in sent] == [
        "anchor",
        "stream.delta",
        "stream.close",
        "stream.finish",
    ]
    assert sent[1]["payload"] == {"kind": "text", "delta": "Hi there"}


@pytest.mark.asyncio
async def test_handle_ai_response_non_stream_returns_fallback_content(monkeypatch) -> None:
    """Non-stream callers get the fallback reply as content for an empty run."""

    _stub_wukongim(monkeypatch)
    _stub_ai_stream(
        monkeypatch,
        [
            {"event_type": "agent_execution_started", "data": {}},
            {"event_type": "workflow_completed", "data": {}},
        ],
    )

    result = await chat_service.handle_ai_response_non_stream(
        project_id="project-1",
        visitor_id="user-1",
        message="hello",
        channel_id="channel-1",
        channel_type=1,
        client_msg_no="msg-1",
        from_uid="agent-1-agent",
    )

    assert result["success"] is True
    assert result["content"] == chat_service.AI_FALLBACK_REPLY
