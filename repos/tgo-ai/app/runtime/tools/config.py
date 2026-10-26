"""Tool agent runtime configuration."""

from __future__ import annotations

from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ModelSettings(BaseSettings):
    """Default model configuration."""

    model_config = SettingsConfigDict(
        env_prefix="TOOLS_RUNTIME__MODEL__",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    name: str = Field(default="openai:gpt-4o", description="Default model identifier")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int = Field(default=4000, ge=100, le=16_000, description="Maximum tokens to generate")
    system_prompt: str = Field(
        default="You are a helpful assistant that has access to a variety of tools.",
        description="Default system prompt",
    )


class MCPSettings(BaseSettings):
    """MCP service configuration."""

    model_config = SettingsConfigDict(
        env_prefix="TOOLS_RUNTIME__MCP__",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    enabled: bool = Field(default=False, description="Whether to enable the MCP service")
    default_url: str | None = Field(default=None, description="Default MCP service URL")


class RAGSettings(BaseSettings):
    """RAG service configuration."""

    model_config = SettingsConfigDict(
        env_prefix="TOOLS_RUNTIME__RAG__",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    enabled: bool = Field(default=False, description="Whether to enable the RAG service")
    default_url: str | None = Field(default=None, description="Default RAG service URL")
    api_key: Optional[str] = Field(default=None, description="Default RAG service API key")


class SupabaseSettings(BaseSettings):
    """Supabase access configuration."""

    model_config = SettingsConfigDict(
        env_prefix="TOOLS_RUNTIME__SUPABASE__",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    url: Optional[str] = Field(default=None, description="Supabase project URL")
    key: Optional[str] = Field(default=None, description="Supabase Service Role Key")
    access_token: Optional[str] = Field(default=None, description="Supabase access token")




class ToolsRuntimeSettings(BaseSettings):
    """Tool agent runtime configuration aggregate."""

    model_config = SettingsConfigDict(
        env_prefix="TOOLS_RUNTIME__",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    model: ModelSettings = Field(default_factory=ModelSettings)
    mcp: MCPSettings = Field(default_factory=MCPSettings)
    rag: RAGSettings = Field(default_factory=RAGSettings)
    supabase: SupabaseSettings = Field(default_factory=SupabaseSettings)
