import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { RunSummary } from "@/types/api";

export default async function HistoryPage() {
  const runs = await apiFetch<RunSummary[]>("/api/runs");

  return (
    <section className="card">
      <h1 className="text-xl font-semibold">Run History</h1>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2">Run ID</th>
              <th className="py-2">Ticker</th>
              <th className="py-2">Date</th>
              <th className="py-2">Status</th>
              <th className="py-2">Links</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-slate-800">
                <td className="py-2 font-mono text-xs">{run.id}</td>
                <td className="py-2">{run.ticker}</td>
                <td className="py-2">{run.analysis_date}</td>
                <td className="py-2 capitalize">{run.status}</td>
                <td className="py-2">
                  <div className="flex gap-3">
                    <Link className="text-cyan-300 hover:underline" href={`/runs/${run.id}`}>
                      Monitor
                    </Link>
                    <Link className="text-cyan-300 hover:underline" href={`/runs/${run.id}/report`}>
                      Report
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
