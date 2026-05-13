"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE, apiFetch } from "@/lib/api";
import type { RunDetail } from "@/types/api";

interface EventPayload {
  type: string;
  payload: Record<string, unknown>;
  ts: string;
}

export default function RunMonitorPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [events, setEvents] = useState<EventPayload[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const detail = await apiFetch<RunDetail>(`/api/runs/${runId}`);
        setRun(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load run");
      }
    };
    void load();
  }, [runId]);

  useEffect(() => {
    const src = new EventSource(`${API_BASE}/api/runs/${runId}/events`);

    const consume = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as EventPayload;
        setEvents((prev) => [data, ...prev].slice(0, 100));

        if (data.type === "run_status") {
          setRun((prev) => (prev ? { ...prev, status: String(data.payload.status) as RunDetail["status"] } : prev));
        }

        if (data.type === "run_chunk") {
          setRun((prev) => {
            if (!prev) return prev;
            const sections = (data.payload.sections ?? {}) as Record<string, string>;
            return {
              ...prev,
              report_sections: {
                ...prev.report_sections,
                ...sections,
              },
            };
          });
        }

        if (data.type === "run_completed") {
          setRun((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              final_decision: String(data.payload.final_decision ?? ""),
              status: "completed",
            };
          });
        }
      } catch {
        // no-op
      }
    };

    src.onmessage = consume;
    src.addEventListener("run_status", consume as unknown as EventListener);
    src.addEventListener("run_chunk", consume as unknown as EventListener);
    src.addEventListener("run_completed", consume as unknown as EventListener);
    src.addEventListener("run_error", consume as unknown as EventListener);

    src.onerror = () => {
      src.close();
    };

    return () => src.close();
  }, [runId]);

  const sectionEntries = useMemo(
    () => Object.entries(run?.report_sections ?? {}).filter(([, value]) => Boolean(value)),
    [run?.report_sections]
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Run Monitor</h1>
          <p className="text-sm text-slate-300">Run ID: {runId}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-700 px-3 py-1 text-xs uppercase tracking-wide">{run?.status ?? "loading"}</span>
          <Link className="btn-secondary" href={`/runs/${runId}/report`}>
            Open Report
          </Link>
        </div>
      </div>

      {error ? <div className="card border-red-500 text-red-300">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-2 text-lg font-semibold">Live Event Feed</h2>
          <div className="max-h-[420px] space-y-2 overflow-auto text-sm">
            {events.length === 0 ? <p className="text-slate-400">Waiting for events…</p> : null}
            {events.map((evt, idx) => (
              <div key={`${evt.ts}-${idx}`} className="rounded border border-slate-700 bg-panel p-2">
                <p className="text-xs uppercase tracking-wide text-cyan-300">{evt.type}</p>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs text-slate-200">
                  {JSON.stringify(evt.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">Current Sections</h2>
          <div className="space-y-3 text-sm">
            {sectionEntries.length === 0 ? <p className="text-slate-400">No report content yet.</p> : null}
            {sectionEntries.map(([key, value]) => (
              <article key={key}>
                <h3 className="font-medium capitalize text-cyan-200">{key.replaceAll("_", " ")}</h3>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-slate-300">{value}</p>
              </article>
            ))}
          </div>

          {run?.final_decision ? (
            <div className="mt-4 rounded border border-cyan-500/40 bg-cyan-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-200">Final Decision</p>
              <p className="mt-1 text-lg font-semibold">{run.final_decision}</p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
