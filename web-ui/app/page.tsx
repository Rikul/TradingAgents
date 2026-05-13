import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { RunSummary } from "@/types/api";

export default async function HomePage() {
  let runs: RunSummary[] = [];
  try {
    runs = await apiFetch<RunSummary[]>("/api/runs");
  } catch {
    runs = [];
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-2xl font-semibold">TradingAgents Dashboard</h1>
        <p className="mt-2 text-sm text-slate-300">
          Start a new analysis run, monitor agents in real time, and review final reports.
        </p>
        <div className="mt-4">
          <Link className="btn-primary" href="/new-run">
            Start New Run
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Recent Runs</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Ticker</th>
                <th className="py-2">Date</th>
                <th className="py-2">Status</th>
                <th className="py-2">Open</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 10).map((run) => (
                <tr key={run.id} className="border-t border-slate-800">
                  <td className="py-2">{run.ticker}</td>
                  <td className="py-2">{run.analysis_date}</td>
                  <td className="py-2 capitalize">{run.status}</td>
                  <td className="py-2">
                    <Link className="text-cyan-300 hover:underline" href={`/runs/${run.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
