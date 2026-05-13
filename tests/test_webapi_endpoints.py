from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient

from webapi.main import app
from webapi.models import RunCreateRequest, RunDetail, RunStatus, RunSummary


def test_health_and_settings() -> None:
    client = TestClient(app)

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    settings = client.get("/api/settings")
    assert settings.status_code == 200
    payload = settings.json()
    assert "environment variables" in payload["env_var_policy"].lower()
    assert "openai" in payload["supported_providers"]


def test_create_run_validates_analysts() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/runs",
        json={
            "ticker": "SPY",
            "analysis_date": "2026-04-20",
            "analysts": [],
            "research_depth": 1,
            "llm_provider": "openai",
            "shallow_thinker": "gpt-5.4-mini",
            "deep_thinker": "gpt-5.4",
            "output_language": "English",
            "checkpoint_enabled": False,
        },
    )

    assert response.status_code == 400
    assert "At least one analyst" in response.text


def test_get_run_not_found() -> None:
    client = TestClient(app)

    response = client.get("/api/runs/does-not-exist")
    assert response.status_code == 404


def test_list_and_get_run_with_manager_patch(monkeypatch) -> None:
    client = TestClient(app)

    req = RunCreateRequest(
        ticker="SPY",
        analysis_date="2026-04-20",
        analysts=["market"],
        research_depth=1,
        llm_provider="openai",
        shallow_thinker="gpt-5.4-mini",
        deep_thinker="gpt-5.4",
        output_language="English",
        checkpoint_enabled=False,
    )
    summary = RunSummary(
        id="run123",
        ticker="SPY",
        analysis_date="2026-04-20",
        status=RunStatus.COMPLETED,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    detail = RunDetail(
        **summary.model_dump(),
        final_decision="Hold",
        report_sections={"final_trade_decision": "**Rating**: Hold"},
    )

    class StubRun:
        id = "run123"
        request = req
        final_decision = "Hold"
        report_sections = {"final_trade_decision": "**Rating**: Hold"}

        def to_detail(self) -> RunDetail:
            return detail

    async def stub_create_run(_req: RunCreateRequest):
        return StubRun()

    async def stub_list_runs():
        return [summary]

    async def stub_get_run(_run_id: str):
        return StubRun()

    monkeypatch.setattr("webapi.main.run_manager.create_run", stub_create_run)
    monkeypatch.setattr("webapi.main.run_manager.list_runs", stub_list_runs)
    monkeypatch.setattr("webapi.main.run_manager.get_run", stub_get_run)

    create_response = client.post(
        "/api/runs",
        json={
            "ticker": "SPY",
            "analysis_date": "2026-04-20",
            "analysts": ["market"],
            "research_depth": 1,
            "llm_provider": "openai",
            "shallow_thinker": "gpt-5.4-mini",
            "deep_thinker": "gpt-5.4",
            "output_language": "English",
            "checkpoint_enabled": False,
        },
    )
    assert create_response.status_code == 200
    assert create_response.json()["runId"] == "run123"

    list_response = client.get("/api/runs")
    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == "run123"

    detail_response = client.get("/api/runs/run123")
    assert detail_response.status_code == 200
    assert detail_response.json()["final_decision"] == "Hold"

    report_response = client.get("/api/runs/run123/report")
    assert report_response.status_code == 200
    assert report_response.json()["final_decision"] == "Hold"
