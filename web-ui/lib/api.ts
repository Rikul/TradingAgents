const SERVER_API_BASE = process.env.API_BASE_URL ?? "http://localhost:8000";
const BROWSER_API_BASE = process.env.NEXT_PUBLIC_BROWSER_API_BASE_URL ?? "";

export const API_BASE = typeof window === "undefined" ? SERVER_API_BASE : BROWSER_API_BASE;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}
