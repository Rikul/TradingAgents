"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { CreateRunPayload } from "@/types/api";

const analystOptions: CreateRunPayload["analysts"] = ["market", "social", "news", "fundamentals"];

export default function NewRunPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CreateRunPayload>({
    ticker: "SPY",
    analysis_date: new Date().toISOString().slice(0, 10),
    analysts: ["market", "news"],
    research_depth: 1,
    llm_provider: "openai",
    shallow_thinker: "gpt-5.4-mini",
    deep_thinker: "gpt-5.4",
    output_language: "English",
    checkpoint_enabled: false,
  });

  const toggleAnalyst = (value: CreateRunPayload["analysts"][number]) => {
    setPayload((prev) => {
      const exists = prev.analysts.includes(value);
      if (exists) {
        return { ...prev, analysts: prev.analysts.filter((a) => a !== value) };
      }
      return { ...prev, analysts: [...prev.analysts, value] };
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ runId: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/runs/${data.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="card">
        <h1 className="text-xl font-semibold">New Analysis Run</h1>
        <p className="mt-1 text-sm text-slate-300">Core MVP fields mirrored from the CLI workflow.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <label className="label">Ticker</label>
          <input className="input" value={payload.ticker} onChange={(e) => setPayload({ ...payload, ticker: e.target.value.toUpperCase() })} required />

          <label className="label mt-3">Analysis date</label>
          <input className="input" type="date" value={payload.analysis_date} onChange={(e) => setPayload({ ...payload, analysis_date: e.target.value })} required />

          <label className="label mt-3">Research depth</label>
          <select className="input" value={payload.research_depth} onChange={(e) => setPayload({ ...payload, research_depth: Number(e.target.value) })}>
            <option value={1}>Shallow (1)</option>
            <option value={3}>Medium (3)</option>
            <option value={5}>Deep (5)</option>
          </select>

          <label className="label mt-3">Output language</label>
          <input className="input" value={payload.output_language} onChange={(e) => setPayload({ ...payload, output_language: e.target.value })} />
        </div>

        <div className="card">
          <label className="label">LLM provider</label>
          <input className="input" value={payload.llm_provider} onChange={(e) => setPayload({ ...payload, llm_provider: e.target.value })} />

          <label className="label mt-3">Shallow model</label>
          <input className="input" value={payload.shallow_thinker} onChange={(e) => setPayload({ ...payload, shallow_thinker: e.target.value })} />

          <label className="label mt-3">Deep model</label>
          <input className="input" value={payload.deep_thinker} onChange={(e) => setPayload({ ...payload, deep_thinker: e.target.value })} />

          <div className="mt-4">
            <p className="label">Analysts</p>
            <div className="grid grid-cols-2 gap-2">
              {analystOptions.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={payload.analysts.includes(opt)} onChange={() => toggleAnalyst(opt)} />
                  <span className="capitalize">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={payload.checkpoint_enabled}
              onChange={(e) => setPayload({ ...payload, checkpoint_enabled: e.target.checked })}
            />
            Enable checkpoint resume
          </label>
        </div>
      </div>

      {error ? <div className="card border-red-500 text-sm text-red-300">{error}</div> : null}

      <div className="flex justify-end">
        <button className="btn-primary disabled:opacity-60" disabled={loading || payload.analysts.length === 0} type="submit">
          {loading ? "Starting..." : "Start Run"}
        </button>
      </div>
    </form>
  );
}
