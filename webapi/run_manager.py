from __future__ import annotations

import asyncio
import contextlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

from .models import ApiEvent, RunCreateRequest, RunDetail, RunStatus, RunSummary


REPORT_KEYS = [
    "market_report",
    "sentiment_report",
    "news_report",
    "fundamentals_report",
    "investment_plan",
    "trader_investment_plan",
    "final_trade_decision",
]


@dataclass
class RunRecord:
    id: str
    request: RunCreateRequest
    status: RunStatus
    created_at: datetime
    updated_at: datetime
    report_sections: Dict[str, str | None] = field(default_factory=dict)
    final_decision: str | None = None
    error: str | None = None
    subscribers: List[asyncio.Queue[ApiEvent]] = field(default_factory=list)
    task: asyncio.Task[Any] | None = None

    def to_summary(self) -> RunSummary:
        return RunSummary(
            id=self.id,
            ticker=self.request.ticker,
            analysis_date=self.request.analysis_date.isoformat(),
            status=self.status,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    def to_detail(self) -> RunDetail:
        return RunDetail(
            **self.to_summary().model_dump(),
            final_decision=self.final_decision,
            report_sections=self.report_sections,
            error=self.error,
        )


class RunManager:
    def __init__(self) -> None:
        self._runs: Dict[str, RunRecord] = {}
        self._lock = asyncio.Lock()

    async def create_run(self, req: RunCreateRequest) -> RunRecord:
        run_id = uuid.uuid4().hex[:12]
        now = datetime.utcnow()
        record = RunRecord(
            id=run_id,
            request=req,
            status=RunStatus.QUEUED,
            created_at=now,
            updated_at=now,
            report_sections={k: None for k in REPORT_KEYS},
        )
        async with self._lock:
            self._runs[run_id] = record
        record.task = asyncio.create_task(self._execute_run(record))
        return record

    async def list_runs(self) -> List[RunSummary]:
        async with self._lock:
            runs = [r.to_summary() for r in self._runs.values()]
        return sorted(runs, key=lambda x: x.created_at, reverse=True)

    async def get_run(self, run_id: str) -> RunRecord | None:
        async with self._lock:
            return self._runs.get(run_id)

    async def cancel_run(self, run_id: str) -> bool:
        record = await self.get_run(run_id)
        if not record or not record.task:
            return False
        if record.task.done():
            return False
        record.task.cancel()
        return True

    async def subscribe(self, run_id: str) -> asyncio.Queue[ApiEvent] | None:
        record = await self.get_run(run_id)
        if not record:
            return None
        q: asyncio.Queue[ApiEvent] = asyncio.Queue(maxsize=200)
        record.subscribers.append(q)
        return q

    async def unsubscribe(self, run_id: str, queue: asyncio.Queue[ApiEvent]) -> None:
        record = await self.get_run(run_id)
        if not record:
            return
        with contextlib.suppress(ValueError):
            record.subscribers.remove(queue)

    async def _publish(self, record: RunRecord, event_type: str, payload: Dict[str, Any]) -> None:
        record.updated_at = datetime.utcnow()
        event = ApiEvent(type=event_type, payload=payload)
        stale: List[asyncio.Queue[ApiEvent]] = []
        for q in record.subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                stale.append(q)
        for q in stale:
            with contextlib.suppress(ValueError):
                record.subscribers.remove(q)

    async def _execute_run(self, record: RunRecord) -> None:
        req = record.request
        try:
            record.status = RunStatus.RUNNING
            await self._publish(record, "run_status", {"status": record.status.value})

            config = DEFAULT_CONFIG.copy()
            config["max_debate_rounds"] = req.research_depth
            config["max_risk_discuss_rounds"] = req.research_depth
            config["quick_think_llm"] = req.shallow_thinker
            config["deep_think_llm"] = req.deep_thinker
            config["backend_url"] = req.backend_url
            config["llm_provider"] = req.llm_provider.lower()
            config["google_thinking_level"] = req.google_thinking_level
            config["openai_reasoning_effort"] = req.openai_reasoning_effort
            config["anthropic_effort"] = req.anthropic_effort
            config["output_language"] = req.output_language
            config["checkpoint_enabled"] = req.checkpoint_enabled

            selected_analysts = [a.lower() for a in req.analysts]
            graph = TradingAgentsGraph(selected_analysts, config=config, debug=True)

            init_state = graph.propagator.create_initial_state(req.ticker, req.analysis_date.isoformat())
            args = graph.propagator.get_graph_args()

            trace: list[dict[str, Any]] = []
            await self._publish(
                record,
                "run_started",
                {
                    "ticker": req.ticker,
                    "analysis_date": req.analysis_date.isoformat(),
                    "analysts": selected_analysts,
                },
            )

            for chunk in graph.graph.stream(init_state, **args):
                for key in REPORT_KEYS:
                    if chunk.get(key):
                        record.report_sections[key] = chunk[key]

                messages = []
                for message in chunk.get("messages", []):
                    msg_type = "system"
                    if isinstance(message, HumanMessage):
                        msg_type = "user"
                    elif isinstance(message, AIMessage):
                        msg_type = "agent"
                    elif isinstance(message, ToolMessage):
                        msg_type = "tool"

                    text = getattr(message, "content", None)
                    if isinstance(text, list):
                        text = " ".join(
                            part.get("text", "") if isinstance(part, dict) else str(part)
                            for part in text
                        )
                    messages.append({"type": msg_type, "content": str(text or "")[:1200]})

                await self._publish(
                    record,
                    "run_chunk",
                    {
                        "messages": messages,
                        "sections": {k: record.report_sections.get(k) for k in REPORT_KEYS if record.report_sections.get(k)},
                    },
                )
                trace.append(chunk)

            final_state = trace[-1] if trace else {}
            if final_state.get("final_trade_decision"):
                record.final_decision = graph.process_signal(final_state["final_trade_decision"])

            base_dir = Path(config["results_dir"]) / req.ticker / req.analysis_date.isoformat()
            await self._publish(
                record,
                "run_completed",
                {
                    "final_decision": record.final_decision,
                    "results_dir": str(base_dir),
                },
            )
            record.status = RunStatus.COMPLETED
            await self._publish(record, "run_status", {"status": record.status.value})

        except asyncio.CancelledError:
            record.status = RunStatus.CANCELED
            await self._publish(record, "run_status", {"status": record.status.value})
            raise
        except Exception as exc:  # noqa: BLE001
            record.status = RunStatus.FAILED
            record.error = str(exc)
            await self._publish(record, "run_error", {"error": record.error})
            await self._publish(record, "run_status", {"status": record.status.value})


run_manager = RunManager()
