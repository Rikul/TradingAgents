export type RunStatus = "queued" | "running" | "completed" | "failed" | "canceled";

export interface RunSummary {
  id: string;
  ticker: string;
  analysis_date: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
}

export interface RunDetail extends RunSummary {
  final_decision?: string | null;
  report_sections: Record<string, string | null>;
  error?: string | null;
}

export interface CreateRunPayload {
  ticker: string;
  analysis_date: string;
  analysts: Array<"market" | "social" | "news" | "fundamentals">;
  research_depth: number;
  llm_provider: string;
  backend_url?: string;
  shallow_thinker: string;
  deep_thinker: string;
  openai_reasoning_effort?: string;
  google_thinking_level?: string;
  anthropic_effort?: string;
  output_language: string;
  checkpoint_enabled: boolean;
}
