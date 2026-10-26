"""Chat-related request/response schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Literal
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema
from app.utils.const import MessageType


class StaffSendPlatformMessageRequest(BaseSchema):
    """Payload for staff-triggered outbound platform messages."""

    channel_id: str = Field(..., description="WuKongIM channel identifier (e.g., {visitor_id}-vtr)")
    channel_type: int = Field(
        ...,
        description="WuKongIM channel type (customer service chat uses 251)",
        example=251,
    )
    payload: Dict[str, Any] = Field(..., description="Platform message payload (matches Platform Service contract)")
    client_msg_no: Optional[str] = Field(
        None,
        description="Optional client-supplied idempotency key; generated when omitted",
    )


class ChatFileUploadResponse(BaseSchema):
    """Response for chat file upload."""

    file_id: str = Field(..., description="UUID of the uploaded file record")
    file_name: str = Field(..., description="Original filename")
    file_size: int = Field(..., description="File size in bytes")
    file_type: str = Field(..., description="MIME type")
    file_url: str = Field(..., description="URL to access the file (e.g., /v1/chat/files/{file_id})")
    channel_id: str = Field(..., description="Channel identifier")
    channel_type: int = Field(..., description="Channel type code")
    uploaded_at: datetime = Field(..., description="Upload timestamp")
    uploaded_by: Optional[str] = Field(None, description="Staff username or 'visitor'")


class ChatCompletionRequest(BaseSchema):
    """Streaming chat request parameters."""

    api_key: str = Field(
        ...,
        description="Platform API key, used to verify the request source",
        examples=["pk_live_xxxxxxxxxxxx"]
    )
    message: str = Field(
        ...,
        description="Message content sent by the user",
        examples=["Hello, how can I help you?"]
    )
    from_uid: str = Field(
        ...,
        description="Unique platform user identifier, used to identify the visitor (note: not the visitor ID)",
        examples=["user_12345", "wx_openid_xxx"]
    )
    extra: Optional[Dict[str, Any]] = Field(
        None,
        description="Extra data, forwarded to WuKongIM together with the message",
        examples=[{"source": "web", "page": "/product/123"}]
    )
    visitor_name: Optional[str] = Field(
        None,
        description="Visitor nickname/name"
    )
    visitor_avatar: Optional[str] = Field(
        None,
        description="Visitor avatar URL"
    )
    msg_type: Optional[MessageType] = Field(
        MessageType.TEXT,
        description="Message type: 1-text, 2-image, 3-file, 4-voice, 5-video",
        examples=[MessageType.TEXT, MessageType.IMAGE]
    )
    forward_user_message_to_wukongim: bool = Field(
        default=True,
        description="Whether to also forward the user message to WuKongIM (enabled by default)",
        examples=[True],
    )
    timeout_seconds: Optional[int] = Field(
        120,
        ge=10,
        le=300,
        description="SSE stream timeout in seconds, default 120, range 10-300"
    )
    channel_id: Optional[str] = Field(
        None,
        description="Custom channel ID; generated automatically if omitted (encoded form of {visitor_id}-vtr)"
    )
    channel_type: Optional[int] = Field(
        None,
        description="Channel type, default 251 (customer service channel)"
    )
    system_message: Optional[str] = Field(
        None,
        description="AI system prompt, used to guide the AI's reply style and behavior",
        examples=["You are a professional customer-service assistant. Reply to users concisely and in a friendly tone."]
    )
    expected_output: Optional[str] = Field(
        None,
        description="Description of the expected output format, to help the AI produce a conforming response",
        examples=["Reply in JSON format with answer and confidence fields"]
    )
    wukongim_only: bool = Field(
        False,
        description="Whether to send only to WuKongIM without returning a stream response to the client. When true, the endpoint returns an accepted event immediately and AI processing runs in the background"
    )
    stream: Optional[bool] = Field(
        True,
        description="Whether to use streaming responses. true (default) returns an SSE stream; false returns a complete JSON response"
    )


class StaffAgentChatRequest(BaseSchema):
    """Request payload for staff-to-agent chat.

    Notes:
    - agent_id is required
    - channel_id will be {agent_id}-agent
    - Response is delivered via WuKongIM
    """

    model_config = ConfigDict(extra="forbid")

    agent_id: UUID = Field(..., description="AI Agent ID to chat with")
    message: str = Field(..., description="Message content to send")
    system_message: Optional[str] = Field(
        None, description="System message/prompt to guide the AI"
    )
    expected_output: Optional[str] = Field(
        None, description="Expected output format or description for the AI"
    )
    timeout_seconds: Optional[int] = Field(
        120, ge=1, le=600, description="Timeout in seconds for AI response"
    )


class StaffAgentChatResponse(BaseSchema):
    """Response payload for staff-to-agent chat."""
    success: bool = Field(..., description="Whether the chat completed successfully")
    message: str = Field(..., description="Status message")
    client_msg_no: str = Field(..., description="Message correlation ID for tracking")


# UI User Action schema

class UIUserActionRequest(BaseSchema):
    """Request payload when a user interacts with a rendered UI component."""

    model_config = ConfigDict(extra="forbid")

    channel_id: str = Field(..., description="WuKongIM channel ID (e.g. '{agent_id}-agent' or '{visitor_id}-vtr')")
    channel_type: int = Field(..., description="WuKongIM channel type")
    action_name: str = Field(..., description="UI action name (e.g. 'book_restaurant', 'submit_feedback')")
    context: Dict[str, Any] = Field(default_factory=dict, description="Action context key-value pairs from data bindings")
    surface_id: Optional[str] = Field(None, description="Optional UI surface identifier")
    agent_id: Optional[UUID] = Field(None, description="AI Agent ID for routing")


class UIUserActionResponse(BaseSchema):
    """Response for UI user action submission."""

    success: bool = Field(..., description="Whether the action was accepted")
    message: str = Field(..., description="Status message")
    client_msg_no: str = Field(..., description="Correlation ID for tracking the response")


# OpenAI-compatible Chat Completion schemas

class OpenAIChatMessage(BaseSchema):
    """OpenAI-compatible chat message."""

    role: Literal["system", "user", "assistant", "function"] = Field(
        ...,
        description="The role of the message author"
    )
    content: str = Field(..., description="The content of the message")
    name: Optional[str] = Field(None, description="The name of the author of this message")


class OpenAIChatCompletionRequest(BaseSchema):
    """Simplified chat completion request.

    Only includes essential fields: messages, stream, and user.
    """

    messages: List[OpenAIChatMessage] = Field(
        ...,
        description="A list of messages comprising the conversation so far"
    )
    stream: Optional[bool] = Field(
        default=False,
        description="Whether to stream partial message deltas"
    )
    user: Optional[str] = Field(
        None,
        description="Unique identifier representing your end-user"
    )


class OpenAIChatCompletionChoice(BaseSchema):
    """OpenAI-compatible chat completion choice."""

    index: int = Field(..., description="The index of this choice")
    message: OpenAIChatMessage = Field(..., description="The generated message")
    finish_reason: Optional[str] = Field(
        None,
        description="Reason the model stopped generating tokens (stop, length, content_filter, null)"
    )


class OpenAIChatCompletionUsage(BaseSchema):
    """OpenAI-compatible token usage statistics."""

    prompt_tokens: int = Field(..., description="Number of tokens in the prompt")
    completion_tokens: int = Field(..., description="Number of tokens in the completion")
    total_tokens: int = Field(..., description="Total tokens used")


class OpenAIChatCompletionResponse(BaseSchema):
    """OpenAI-compatible chat completion response.

    This schema is compatible with OpenAI's ChatGPT API format.
    See: https://platform.openai.com/docs/api-reference/chat/object
    """

    id: str = Field(..., description="Unique identifier for the chat completion")
    object: Literal["chat.completion"] = Field(
        default="chat.completion",
        description="Object type, always 'chat.completion'"
    )
    created: int = Field(..., description="Unix timestamp of when the completion was created")
    model: str = Field(..., description="The model used for completion")
    choices: List[OpenAIChatCompletionChoice] = Field(
        ...,
        description="List of completion choices"
    )
    usage: OpenAIChatCompletionUsage = Field(..., description="Token usage statistics")


# OpenAI-compatible streaming response schemas

class OpenAIChatCompletionDelta(BaseSchema):
    """OpenAI-compatible delta object for streaming responses."""

    role: Optional[Literal["system", "user", "assistant", "function"]] = Field(
        None,
        description="The role of the message author (only in first chunk)"
    )
    content: Optional[str] = Field(None, description="The content delta")


class OpenAIChatCompletionChunkChoice(BaseSchema):
    """OpenAI-compatible choice object for streaming responses."""

    index: int = Field(..., description="The index of this choice")
    delta: OpenAIChatCompletionDelta = Field(..., description="The delta content")
    finish_reason: Optional[str] = Field(
        None,
        description="Reason the model stopped generating tokens (stop, length, content_filter, null)"
    )


class OpenAIChatCompletionChunk(BaseSchema):
    """OpenAI-compatible streaming chunk response.

    This schema is compatible with OpenAI's ChatGPT API streaming format.
    See: https://platform.openai.com/docs/api-reference/chat/streaming
    """

    id: str = Field(..., description="Unique identifier for the chat completion")
    object: Literal["chat.completion.chunk"] = Field(
        default="chat.completion.chunk",
        description="Object type, always 'chat.completion.chunk'"
    )
    created: int = Field(..., description="Unix timestamp of when the completion was created")
    model: str = Field(..., description="The model used for completion")
    choices: List[OpenAIChatCompletionChunkChoice] = Field(
        ...,
        description="List of completion choices with delta content"
    )
