"""OpenAI-compatible Chat Completions API endpoint.

This module provides a fully OpenAI-compatible chat completions endpoint
that proxies requests to various LLM providers based on the provider_id.
"""

import uuid
from typing import Union

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import build_error_responses
from app.core.logging import get_logger
from app.dependencies import get_db
from app.schemas.chat import (
    ChatCompletionRequest,
    ChatCompletionResponse,
)
from app.services.chat_service import ChatService

logger = get_logger(__name__)

router = APIRouter()


def get_chat_service(db: AsyncSession = Depends(get_db)) -> ChatService:
    """Get ChatService instance."""
    return ChatService(db)


_STREAMING_EXAMPLE = (
    'data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1234567890,'
    '"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n'
    'data: {"type": "tool_call", "tool_call": {"id": "call_123", "type": "function", "function": {"name": "rag_search_abc123", "arguments": "{\\"query\\":\\"hello\\"}"}}}\n\n'
    'data: {"type": "tool_result", "tool_call_id": "call_123", "result": "<documents>...</documents>"}\n\n'
    'data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1234567890,'
    '"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n'
    "data: [DONE]\n\n"
)


_completions_success_responses = {
    200: {
        "description": "Successful response. Returns JSON when `stream=false` and Server-Sent Events when `stream=true`.",
        "content": {
            "application/json": {
                "schema": {
                    "$ref": "#/components/schemas/ChatCompletionResponse",
                },
                "example": {
                    "id": "chatcmpl-abc123",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Hello! How can I help you today?",
                            },
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {
                        "prompt_tokens": 10,
                        "completion_tokens": 8,
                        "total_tokens": 18,
                    },
                },
            },
            "text/event-stream": {
                "schema": {
                    "type": "string",
                    "description": "Server-Sent Events (SSE) stream in OpenAI format with Pelatis-AI tool extensions.",
                },
                "examples": {
                    "streaming_response": {
                        "summary": "Streaming response example with tool calls",
                        "value": _STREAMING_EXAMPLE,
                    },
                },
            },
        },
    }
}


@router.post(
    "/completions",
    response_model=ChatCompletionResponse,
    responses={
        **_completions_success_responses,
        **build_error_responses(
            [400, 404, 500],
            {
                400: "Invalid request parameters or the model does not support this operation",
                404: "The specified LLM provider was not found",
                500: "Backend LLM provider call failed or internal system error",
            },
        ),
    },
    summary="Create chat completion",
    description="""
Creates a chat completion request. This endpoint is fully compatible with the OpenAI Chat Completions API format and adds support for multiple providers, dynamic tool loading and automatic RAG search.

### 1. Request Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `provider_id` | UUID | Yes | Provider ID in the `ai_llm_providers` table. Determines which API keys and vendor are used. |
| `model` | String | Yes | Model identifier (e.g. "gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"). |
| `messages` | Array | Yes | Conversation message list. Supported roles: `system`, `user`, `assistant`, `tool`. |
| `stream` | Boolean | No | Whether to stream the output. Default `false`. |
| `temperature` | Float | No | Sampling temperature (0-2). |
| `max_tokens` | Integer | No | Maximum number of tokens to generate. |

### 2. Pelatis-AI Extensions

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `tool_ids` | Array[UUID] | IDs of tools to load dynamically. The backend reads MCP tool definitions from the database and converts them to the OpenAI function format before sending them to the model. |
| `collection_ids` | Array[String] | RAG collection IDs. The backend automatically generates one RAG search tool per collection (e.g. `rag_search_xxx`). |
| `max_tool_rounds` | Integer | Maximum number of automatic tool-calling rounds (agentic loop). Default `5`, maximum `20`. |

### 3. Return Value

#### Non-streaming mode (stream=false)
Returns a standard OpenAI-compatible JSON object (`ChatCompletionResponse`).
*   If a tool call is triggered and `max_tool_rounds > 0`, the backend **executes the tools automatically** and requests the LLM again with the results until a final reply is produced.
*   The `usage` field contains the token consumption accumulated over the whole agentic loop.

#### Streaming mode (stream=true)
Returns `text/event-stream`. In addition to standard OpenAI chunks, it contains Pelatis-AI custom tool execution events:

| Event type (SSE data) | Description |
| :--- | :--- |
| `{"id":"...","object":"chat.completion.chunk",...}` | Standard text delta or raw model output. |
| `{"type": "tool_call", "tool_call": {...}}` | **Pelatis-AI custom event**: tells the frontend that the backend is automatically executing a tool call. |
| `{"type": "tool_result", "tool_call_id": "...", "result": "..."}` | **Pelatis-AI custom event**: the tool finished executing and returned its result. |
| `data: [DONE]` | End of stream. |

### 4. Provider Support
*   **OpenAI / OpenAI Compatible**: full tool calling and streaming support.
*   **Anthropic (Claude)**: tool calling supported.
*   **Google (Gemini)**: tool calling supported.

### 5. Error Handling
*   `404`: `provider_id` does not exist or does not belong to the current project.
*   `400`: invalid `messages` format or `max_tool_rounds` out of range.
*   `500`: the remote provider service is unavailable or timed out.
""",
)
async def create_chat_completion(
    request: ChatCompletionRequest,
    project_id: uuid.UUID = Query(..., description="Project ID for authorization"),
    chat_service: ChatService = Depends(get_chat_service),
) -> Union[ChatCompletionResponse, StreamingResponse]:
    """Create a chat completion.

    Supports both streaming and non-streaming responses based on the `stream` parameter.
    Uses the specified LLM provider credentials to proxy the request to the actual LLM API.
    """
    logger.info(
        "Chat completion request",
        project_id=str(project_id),
        provider_id=str(request.provider_id),
        model=request.model,
        stream=request.stream,
        message_count=len(request.messages),
    )

    if request.stream:
        return StreamingResponse(
            chat_service.create_completion_stream(request, project_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    return await chat_service.create_completion(request, project_id)

