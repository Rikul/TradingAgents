# TradingAgents Web Interface — Phase 1 Research & Design Proposal

## CLI Analysis

### Current commands and features

The CLI is exposed via the `tradingagents` entrypoint and implemented with Typer.

- `tradingagents analyze`
  - Main interactive analysis workflow.
  - Options:
    - `--checkpoint`: enable LangGraph checkpoint/resume.
    - `--clear-checkpoints`: clear saved checkpoints before run.
- `tradingagents` (without explicit subcommand) is effectively the Typer app and guides users into the same interactive analyze flow.

### Typical user workflow (step-by-step)

1. Launch CLI (`tradingagents` or `python -m cli.main`).
2. See welcome panel + announcements.
3. Provide runtime inputs in this order:
   1) ticker
   2) analysis date
   3) output language
   4) analyst team selection
   5) research depth
   6) LLM provider
   7) shallow/deep model choices
   8) provider-specific reasoning config (Google/OpenAI/Anthropic)
4. Graph initializes with selected agents and config.
5. Live execution UI updates in near real-time:
   - Team/agent status progression
   - Message + tool-call stream
   - Current report section preview
   - Stats (LLM calls, tool calls, tokens, elapsed time)
6. At completion:
   - final state is processed for final rating
   - all statuses marked completed
7. User is prompted to:
   - save report folder/files
   - optionally display full report in terminal

### Configuration options available

Configuration comes from `DEFAULT_CONFIG` + interactive overrides:

- LLM/provider: provider, quick/deep models, backend URL, provider-specific effort/thinking controls.
- Workflow controls: debate rounds, risk discussion rounds, recursion limit.
- Persistence: results dir, cache dir, memory log path, checkpoint enabled.
- Data source controls: category-level vendor selection + tool-level overrides.
- Output localization: final report language.

### Data and outputs displayed

Real-time UI panes include:
- Progress table (team/agent status: pending, in_progress, completed, error).
- Message/tool stream (deduplicated message trace + tool invocation summaries).
- Current report panel (most recently updated report section).
- Footer metrics (agent/report completion, llm/tool usage, token in/out, elapsed).

Persisted outputs include:
- Per-run logs (`message_tool.log`).
- Per-section markdown files under organized folders:
  - `1_analysts`, `2_research`, `3_trading`, `4_risk`, `5_portfolio`
- Consolidated `complete_report.md`.
- Memory log updates and optional checkpoint DBs.

### How multiple agents interact and coordinate

The graph orchestration is deterministic and ordered:

1. Selected analyst nodes execute in sequence.
   - Each analyst may call tools repeatedly until no tool calls remain.
   - Message clear nodes separate analysts.
2. Bull/Bear researchers alternate debate rounds.
   - Transition is conditional on debate counter and latest responder.
3. Research Manager produces structured investment plan.
4. Trader converts plan into structured trading proposal.
5. Risk analysts debate in rotating order (aggressive → conservative → neutral).
6. Portfolio Manager synthesizes and emits final decision.

Routing is handled by `ConditionalLogic` and a LangGraph state machine (`GraphSetup.setup_graph`).

### Agent decision-making process

- Analysts: prompt-driven analysis + tool usage (market/social/news/fundamentals) to generate reports.
- Debate agents (bull/bear, risk analysts): iterative conversational argumentation stored in debate histories.
- Decision agents (Research Manager, Trader, Portfolio Manager):
  - use structured output schemas (`ResearchPlan`, `TraderProposal`, `PortfolioDecision`)
  - render back to markdown for compatibility with existing downstream display/storage
- Final signal extraction:
  - deterministic parsing (`SignalProcessor` + `parse_rating`) from Portfolio Manager markdown rating line.

---

## Proposed Web UI Architecture

### Page structure and routes

Recommended route map:

- `/` — Dashboard/Home
  - quick launch, recent runs, environment readiness
- `/new-run` — Analysis configuration wizard
- `/runs/:runId` — Live run monitor (streaming)
- `/runs/:runId/report` — Final report viewer + export
- `/history` — Run history/search/filter
- `/settings` — Provider keys, defaults, data vendor config
- `/checkpoints` — Resume management / clear checkpoints

### Confirmed scope decisions (from review)

- Repository layout: **monorepo is preferred**.
- Runtime transport: **SSE + FastAPI service is approved** for Phase 2.
- Secret handling: **API keys remain environment-variable based** (no key persistence UI).
- UX policy: skip explicit per-run **\"not financial advice\" modal** in Phase 2 MVP.
- Delivery constraint: **existing Docker workflow must continue to work**.

### Component hierarchy (high level)

- `AppShell`
  - `TopNav`
  - `Sidebar`
  - `ThemeToggle`
  - route-level content

Run configuration:
- `RunWizardPage`
  - `TickerStep`
  - `DateStep`
  - `LanguageStep`
  - `AnalystSelectionStep`
  - `ResearchDepthStep`
  - `ProviderStep`
  - `ModelStep`
  - `ProviderReasoningStep`
  - `RunSummaryCard`

Live monitor:
- `RunMonitorPage`
  - `RunHeader` (run metadata + status)
  - `AgentProgressBoard`
  - `LiveMessageFeed`
  - `ToolCallFeed`
  - `CurrentReportPanel`
  - `RunStatsBar`
  - `ControlBar` (cancel/retry/save)

Report view:
- `ReportPage`
  - `SectionTabs`
  - `MarkdownReportViewer`
  - `DecisionCard`
  - `ExportActions`

### Data flow and state management strategy

Use hybrid state strategy:

- Server state: TanStack Query (runs, run status, report sections, history).
- Client/UI state: Zustand (wizard progress, local UI toggles/filters, panel layout).
- Streaming events:
  - event reducer pattern to append messages/tool calls
  - derived selectors for agent/report completion counters

State boundaries:
- Backend is source of truth for persisted run state.
- Frontend maintains ephemeral stream buffer for smooth rendering.

### Real-time updates approach

Preferred: **SSE (Server-Sent Events)** for MVP.

Why SSE first:
- CLI stream is append-only event-like output (ideal for one-way stream).
- Simpler infra than WebSocket; easy reconnect semantics.
- Works well for per-run event channel: `/api/runs/:runId/events`.

Optional later upgrade:
- WebSocket for bi-directional controls (live intervention, human-in-the-loop edits).

### Backend API integration design

Introduce a thin service layer wrapping existing Python graph runtime:

- `POST /api/runs`
  - start run with selected config; returns `runId`
- `GET /api/runs/:runId`
  - run metadata + current status
- `GET /api/runs/:runId/events` (SSE)
  - messages, tool calls, status transitions, section updates, stats
- `POST /api/runs/:runId/cancel`
- `GET /api/runs/:runId/report`
- `GET /api/runs` (history)
- `GET /api/settings` / `PUT /api/settings`
- `POST /api/checkpoints/clear`

Backend implementation options:
- Preferred: FastAPI service in same repo, orchestrating `TradingAgentsGraph` runs in background tasks.
- Persist run metadata in SQLite (MVP) with filesystem pointers to report artifacts.

### Docker workflow compatibility (must-have)

To preserve current usage (`docker compose run --rm tradingagents`), add web components without breaking existing container behavior:

- Keep the current `tradingagents` CLI service as-is for backward compatibility.
- Add a separate web stack profile in `docker-compose.yml`, e.g.:
  - `tradingagents-api` (FastAPI backend wrapper over `TradingAgentsGraph`)
  - `tradingagents-web` (Next.js frontend)
- Use shared `.env`/`.env.enterprise` injection for provider keys; do not add UI key storage.
- Mount/report directories consistently so CLI and web runs can read/write the same artifacts.
- Maintain one-command paths:
  - CLI path (unchanged): `docker compose run --rm tradingagents`
  - Web path (new): `docker compose --profile web up tradingagents-api tradingagents-web`

This keeps existing users unblocked while enabling incremental rollout of the web UI.

---

## Tech Stack Recommendation

### Framework choice

**Next.js (App Router) + React + TypeScript (strict mode)**

Justification:
- Great DX for complex dashboards.
- Supports route-based code splitting naturally.
- Flexible deployment: static/dynamic/hybrid.
- Strong ecosystem for auth, middleware, server actions if needed later.
- Easy co-location of API route handlers for early MVP if desired.

### UI component library

**shadcn/ui (Radix + Tailwind primitives)**

Why:
- Modern financial dashboard look with full customization.
- Accessible building blocks (dialogs, tabs, tables, toasts).
- Works naturally with dark mode and Tailwind tokens.

### State management

- **TanStack Query** for async/server cache.
- **Zustand** for lightweight client UI/global state.
- Avoid Redux complexity unless multi-team collaboration later demands stricter patterns.

### Data fetching strategy

- Query for standard REST resources.
- SSE hook (`EventSource`) for live run events.
- Optimistic UI only for low-risk controls (e.g., cancel requested).

### Additional libraries

- `tailwindcss`, `clsx`, `tailwind-merge`, `class-variance-authority`
- `react-hook-form` + `zod` (wizard validation)
- `react-markdown` + `remark-gfm` (report rendering)
- `date-fns` (date/time formatting)
- `recharts` (optional charts for token/tool/time trends)
- `axe-core` / `@testing-library` / `playwright` for accessibility + E2E testing

---

## Implementation Plan

### Core MVP features (must-have)

1. Run wizard (all CLI inputs mirrored)
2. Start run + live monitor (agent status, messages, tool calls, current report)
3. Final report viewer with section navigation
4. Run history list + detail pages
5. Settings page for defaults/provider selection
6. Dark mode + responsive layout + loading/error/empty states
7. Docker-compatible launch path that coexists with current CLI container flow

### Enhanced features (nice-to-have)

1. Resume interrupted runs from checkpoints in UI
2. Compare two runs side-by-side
3. Token/tool usage charts and cost estimates
4. Export bundles (zip of markdowns/logs)
5. Keyboard shortcuts + command palette

### Future considerations

1. Multi-user auth and RBAC
2. Portfolio watchlist + scheduled recurring analyses
3. Human-in-the-loop approval gates before trader/risk stages
4. Broker/simulator execution bridge with audit logs
5. Model A/B experimentation dashboard

### Priority order and rough timeline estimate

Assuming one full-stack engineer, 2-week sprints:

- Sprint 1 (Week 1-2)
  - Scaffold monorepo web app + FastAPI service, design system, settings (env-variable based), run wizard, run creation API contract, Docker profile wiring.
- Sprint 2 (Week 3-4)
  - SSE run monitor, event reducer/state, report page, history page.
- Sprint 3 (Week 5-6)
  - Checkpoint controls, exports, polish, accessibility pass, integration tests, docs.

Estimated MVP readiness: **4 weeks** (Sprints 1-2).
Estimated production-hardening: **6+ weeks** (with Sprint 3 scope).

---

## UI/UX Mockup Description

### Layout sketch (desktop)

```text
┌────────────────────────────────────────────────────────────────────┐
│ Top Nav: Logo | New Run | History | Settings | Theme Toggle      │
├───────────────┬────────────────────────────────────────────────────┤
│ Left Sidebar  │ Run Header (Ticker, Date, Status, Elapsed)        │
│ - Runs list   ├───────────────────────────┬────────────────────────┤
│ - Filters     │ Agent Progress Board      │ Current Report         │
│ - Quick stats │ (team/agent status table) │ (markdown preview)     │
│               ├───────────────────────────┴────────────────────────┤
│               │ Message + Tool Feed (streaming timeline)          │
│               ├────────────────────────────────────────────────────┤
│               │ Footer Stats: LLM calls | Tools | Tokens | Reports│
└───────────────┴────────────────────────────────────────────────────┘
```

### Color scheme and design aesthetic

- Dark-first financial dashboard style.
- Palette:
  - Background: slate/charcoal (`#0B1220`, `#111827`)
  - Surface: muted slate (`#1F2937`)
  - Primary accent: cyan/blue (`#22D3EE`, `#3B82F6`)
  - Success: green (`#22C55E`), Warning: amber (`#F59E0B`), Error: red (`#EF4444`)
- Typography:
  - Inter/SF Pro style sans, medium weight headings, high legibility data tables.

### Key interactions and flows

- New Run:
  - guided wizard with validation and tooltips matching CLI terminology.
- Live monitor:
  - auto-scroll feed with pause/resume stream toggle.
  - click agent row → focus related messages/sections.
- Report review:
  - sticky section navigation, collapse/expand long sections, copy/export actions.
- Failure handling:
  - actionable error banners with retry and log detail drawer.

### Responsive approach

- Mobile:
  - stacked cards instead of multi-pane grid.
  - bottom sheet for message feed filters and run controls.
- Tablet:
  - 2-column layout (progress + report) with collapsible stream panel.
- Desktop:
  - full multi-pane dashboard with persistent nav.

---

## Phase 2 Scoping (remaining single open item)

1. Should checkpoint resume controls be included in Phase 2 MVP UI, or deferred to Phase 2.1?
