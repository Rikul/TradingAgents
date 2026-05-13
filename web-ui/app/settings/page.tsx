import { apiFetch } from "@/lib/api";

interface SettingsResponse {
  env_var_policy: string;
  supported_providers: string[];
}

export default async function SettingsPage() {
  const settings = await apiFetch<SettingsResponse>("/api/settings");

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-slate-300">{settings.env_var_policy}</p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Supported Providers</h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {settings.supported_providers.map((provider) => (
            <li key={provider} className="rounded border border-slate-700 bg-panel px-3 py-2 capitalize">
              {provider}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
