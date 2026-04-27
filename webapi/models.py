from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class RunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class RunCreateRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=32)
    analysis_date: date
    analysts: List[Literal["market", "social", "news", "fundamentals"]]
    research_depth: int = Field(default=1, ge=1, le=5)
    llm_provider: str = Field(default="openai")
    backend_url: Optional[str] = None
    shallow_thinker: str = Field(default="gpt-5.4-mini")
    deep_thinker: str = Field(default="gpt-5.4")
    google_thinking_level: Optional[str] = None
    openai_reasoning_effort: Optional[str] = None
    anthropic_effort: Optional[str] = None
    output_language: str = Field(default="English")
    checkpoint_enabled: bool = False


class RunSummary(BaseModel):
    id: str
    ticker: str
    analysis_date: str
    status: RunStatus
    created_at: datetime
    updated_at: datetime


class RunDetail(RunSummary):
    final_decision: Optional[str] = None
    report_sections: Dict[str, str | None] = Field(default_factory=dict)
    error: Optional[str] = None


class ApiSettings(BaseModel):
    env_var_policy: str = "API keys are read from environment variables only"
    supported_providers: List[str] = Field(
        default_factory=lambda: [
            "openai",
            "google",
            "anthropic",
            "xai",
            "deepseek",
            "qwen",
            "glm",
            "openrouter",
            "azure",
            "ollama",
        ]
    )


class ApiEvent(BaseModel):
    type: str
    payload: Dict[str, Any]
    ts: datetime = Field(default_factory=datetime.utcnow)
