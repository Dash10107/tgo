"""Models used internally by the tool runtime."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class MCPConfig(BaseModel):
    """MCP server configuration."""

    url: Optional[str] = Field(default=None, description="MCP service URL")
    tools: Optional[List[str]] = Field(default=None, description="List of MCP tools to expose")
    auth_required: bool = Field(default=False, description="Whether authentication is required")


class RagConfig(BaseModel):
    """RAG configuration."""

    api_key: Optional[str] = Field(default=None, description="RAG service API key")
    rag_url: Optional[str] = Field(default=None, description="RAG service URL")
    project_id: Optional[str] = Field(default=None, description="Project ID for RAG service calls")
    collections: Optional[List[str]] = Field(default=None, description="List of enabled collections")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="Search filters")



class WorkflowConfig(BaseModel):
    """Workflow configuration."""

    workflow_url: Optional[str] = Field(default=None, description="Workflow service URL")
    project_id: Optional[str] = Field(default=None, description="Project ID for Workflow service calls")
    workflows: Optional[List[str]] = Field(default=None, description="List of enabled workflow IDs")



class LLMProviderCredentials(BaseModel):
    """Typed structure for resolved LLM provider credentials."""

    provider_kind: str = Field(
        ..., description="openai | anthropic | google | openai_compatible"
    )
    api_key: str = Field(..., description="API key for the provider")
    api_base_url: Optional[str] = Field(
        default=None, description="Custom API base URL (for compatible vendors)"
    )
    organization: Optional[str] = Field(
        default=None, description="Organization/Tenant identifier"
    )
    timeout: Optional[float] = Field(
        default=None, description="Request timeout in seconds"
    )
    vendor: Optional[str] = Field(
        default=None, description="Vendor label (e.g., deepseek, openai, openrouter)"
    )

class AgentConfig(BaseModel):
    """Model configuration for a single agent."""

    model_name: Optional[str] = Field(default=None, description="Model identifier")
    temperature: Optional[float] = Field(default=None, description="Sampling temperature")
    max_tokens: Optional[int] = Field(default=None, description="Maximum number of tokens to generate")
    system_prompt: Optional[str] = Field(
        default=None,
        description="System prompt",
    )
    mcp_config: Optional[MCPConfig] = Field(default=None, description="MCP configuration")
    rag: Optional[RagConfig] = Field(default=None, description="RAG configuration")
    workflow: Optional[WorkflowConfig] = Field(default=None, description="Workflow configuration")
    enable_memory: Optional[bool] = Field(default=None, description="Whether to enable memory for this agent")
    system_message: Optional[str] = Field(default=None, description="Custom system message")
    expected_output: Optional[str] = Field(default=None, description="Expected output format")

    # Extended configuration parameters
    markdown: Optional[bool] = Field(default=None, description="Whether to use markdown output")
    add_datetime_to_context: Optional[bool] = Field(default=None, description="Whether to add the date and time to the context")
    add_location_to_context: Optional[bool] = Field(default=None, description="Whether to add location information to the context")
    timezone_identifier: Optional[str] = Field(default=None, description="Timezone identifier")
    tool_call_limit: Optional[int] = Field(default=None, description="Tool call limit per run")
    num_history_runs: Optional[int] = Field(default=None, description="Limit on the number of history runs")

    ui_mode: Optional[str] = Field(
        default=None,
        description="UI rendering mode: 'json_render' (json-render SpecStream protocol)",
    )

    provider_credentials: Optional[LLMProviderCredentials] = Field(
        default=None,
        description="Resolved LLM provider credentials for this agent",
    )


class AgentRunRequest(BaseModel):
    """Tool runtime execution request."""

    message: str = Field(..., description="User input")

    config: Optional[AgentConfig] = Field(default=None, description="Agent execution configuration")
    session_id: Optional[str] = Field(default=None, description="Session ID")
    user_id: Optional[str] = Field(default=None, description="User ID")
    project_id: Optional[str] = Field(default=None, description="Project ID")
    agent_id: Optional[str] = Field(default=None, description="ID of the executing agent")
    request_id: Optional[str] = Field(default=None, description="Request tracing ID")
    skills_enabled: bool = Field(default=True, description="Whether to enable skill discovery")
    stream: bool = Field(default=False, description="Whether to enable streaming output")
    stream_intermediate_steps: bool = Field(
        default=False,
        description="Whether streaming output includes intermediate tool steps",
    )
    enable_memory: bool = Field(default=False, description="Whether to enable conversation memory")


class ToolExecution(BaseModel):
    """Execution result of a single tool call."""

    tool_call_id: Optional[str] = Field(default=None)
    tool_name: Optional[str] = Field(default=None)
    tool_args: Optional[Dict[str, Any]] = Field(default=None)
    tool_call_error: Optional[bool] = Field(default=False)
    result: Optional[str] = Field(default=None)


class AgentRunResponse(BaseModel):
    """Tool agent execution result."""

    content: Optional[Any] = Field(default=None)
    tools: Optional[List[ToolExecution]] = Field(default=None)
    success: bool = Field(default=True)
    error: Optional[str] = Field(default=None)
    metadata: Optional[Dict[str, Any]] = Field(default=None)


class StreamEvent(BaseModel):
    """Base class for streaming events."""

    event: str = Field(...)
    timestamp: Optional[str] = Field(default=None)


class ContentStreamEvent(StreamEvent):
    event: str = Field(default="content")
    content: Optional[str] = Field(default=None)


class ToolCallStreamEvent(StreamEvent):
    event: str = Field(default="tool_call")
    tool_call_id: Optional[str] = Field(default=None)
    tool_name: str = Field(...)
    tool_input: Optional[Dict[str, Any]] = Field(default=None)
    tool_output: Optional[str] = Field(default=None)
    tool_call_error: Optional[bool] = Field(default=False)
    status: str = Field(default="started")


class ErrorStreamEvent(StreamEvent):
    event: str = Field(default="error")
    error: str = Field(...)
    error_type: Optional[str] = Field(default=None)


class CompleteStreamEvent(StreamEvent):
    event: str = Field(default="complete")
    final_response: Optional[AgentRunResponse] = Field(default=None)


StreamEventType = Union[
    ContentStreamEvent,
    ToolCallStreamEvent,
    ErrorStreamEvent,
    CompleteStreamEvent,
]
