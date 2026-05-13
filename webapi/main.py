from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.checkpointer import clear_all_checkpoints

from .models import ApiSettings, RunCreateRequest
from .run_manager import run_manager

app = FastAPI(title="TradingAgents Web API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/settings", response_model=ApiSettings)
def get_settings() -> ApiSettings:
    return ApiSettings()


@app.post("/api/runs")
async def create_run(req: RunCreateRequest) -> dict[str, str]:
    if not req.analysts:
        raise HTTPException(status_code=400, detail="At least one analyst must be selected")
    run = await run_manager.create_run(req)
    return {"runId": run.id}


@app.get("/api/runs")
async def list_runs():
    return await run_manager.list_runs()


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    run = await run_manager.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run.to_detail()


@app.post("/api/runs/{run_id}/cancel")
async def cancel_run(run_id: str) -> dict[str, bool]:
    ok = await run_manager.cancel_run(run_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Run cannot be canceled")
    return {"ok": True}


@app.get("/api/runs/{run_id}/events")
async def run_events(run_id: str):
    queue = await run_manager.subscribe(run_id)
    if queue is None:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_stream() -> AsyncIterator[str]:
        try:
            while True:
                event = await queue.get()
                data = event.model_dump()
                yield f"event: {event.type}\n"
                yield f"data: {json.dumps(data, default=str)}\n\n"
        finally:
            await run_manager.unsubscribe(run_id, queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/runs/{run_id}/report")
async def get_report(run_id: str):
    run = await run_manager.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "runId": run.id,
        "ticker": run.request.ticker,
        "analysis_date": run.request.analysis_date.isoformat(),
        "sections": run.report_sections,
        "final_decision": run.final_decision,
    }


@app.post("/api/checkpoints/clear")
def clear_checkpoints() -> dict[str, int]:
    count = clear_all_checkpoints(DEFAULT_CONFIG["data_cache_dir"])
    return {"cleared": count}
