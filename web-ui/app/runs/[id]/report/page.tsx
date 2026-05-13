import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface ReportResponse {
  runId: string;
  ticker: string;
  analysis_date: string;
  final_decision?: string | null;
  sections: Record<string, string | null>;
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await apiFetch<ReportResponse>(`/api/runs/${id}/report`);

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Run Report</h1>
          <p className="text-sm text-slate-300">
            {report.ticker} · {report.analysis_date}
          </p>
        </div>
        <Link href={`/runs/${id}`} className="btn-secondary">
          Back to Live Monitor
        </Link>
      </div>

      {report.final_decision ? (
        <section className="card">
          <p className="text-xs uppercase tracking-wide text-cyan-200">Final Decision</p>
          <p className="mt-1 text-lg font-semibold">{report.final_decision}</p>
        </section>
      ) : null}

      {Object.entries(report.sections).map(([key, content]) => (
        <section key={key} className="card">
          <h2 className="text-lg font-semibold capitalize">{key.replaceAll("_", " ")}</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{content ?? "No content generated."}</pre>
        </section>
      ))}
    </div>
  );
}
