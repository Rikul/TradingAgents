#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="http://127.0.0.1:8000"
WEB_URL="http://127.0.0.1:3000"

cleanup() {
  if [[ -n "${WEB_PID:-}" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" || true
  fi
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" || true
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"

python -m uvicorn webapi.main:app --host 127.0.0.1 --port 8000 >/tmp/tradingagents-webapi.log 2>&1 &
API_PID=$!

for _ in {1..40}; do
  if curl -fsS "$API_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
curl -fsS "$API_URL/health" >/dev/null

NEXT_PUBLIC_API_BASE_URL="$API_URL" npm --prefix web-ui run start >/tmp/tradingagents-web.log 2>&1 &
WEB_PID=$!

for _ in {1..60}; do
  if curl -fsS "$WEB_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
curl -fsS "$WEB_URL" >/dev/null

HOME_HTML="$(curl -fsS "$WEB_URL")"
NEW_HTML="$(curl -fsS "$WEB_URL/new-run")"
HISTORY_HTML="$(curl -fsS "$WEB_URL/history")"
SETTINGS_HTML="$(curl -fsS "$WEB_URL/settings")"

[[ "$HOME_HTML" == *"TradingAgents Dashboard"* ]]
[[ "$HOME_HTML" == *"Start New Run"* ]]
[[ "$NEW_HTML" == *"New Analysis Run"* ]]
[[ "$HISTORY_HTML" == *"Run History"* ]]
[[ "$SETTINGS_HTML" == *"Supported Providers"* ]]

RUN_ID="$(curl -fsS -X POST "$API_URL/api/runs" -H 'Content-Type: application/json' -d '{"ticker":"SPY","analysis_date":"2026-04-20","analysts":["market"],"research_depth":1,"llm_provider":"openai","shallow_thinker":"gpt-5.4-mini","deep_thinker":"gpt-5.4","output_language":"English","checkpoint_enabled":false}' | python -c 'import json,sys; print(json.load(sys.stdin)["runId"])')"

RUN_MONITOR_HTML="$(curl -fsS "$WEB_URL/runs/$RUN_ID")"
RUN_REPORT_HTML="$(curl -fsS "$WEB_URL/runs/$RUN_ID/report")"

[[ "$RUN_MONITOR_HTML" == *"Run Monitor"* ]]
[[ "$RUN_REPORT_HTML" == *"Run Report"* ]]

echo "GUI smoke verification passed for dashboard/new-run/history/settings/monitor/report routes."
