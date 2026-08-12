import { Logo } from '@/components/ui/Logo'

/**
 * Shown when the Supabase env vars are absent. Day 1 has a real chance of
 * someone cloning this and running `npm run dev` before creating .env — this
 * makes that state self-explanatory instead of a blank screen.
 */
export function SetupRequiredPage({ missing }: { missing: string[] }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6 py-12">
      <div className="w-full max-w-lg">
        <Logo variant="onLight" withWordmark />

        <h1 className="mt-8 font-display text-2xl font-bold text-navy-900">
          Supabase is not configured
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          The app cannot reach the database until these environment variables are set:
        </p>

        <ul className="mt-4 space-y-1.5">
          {missing.map((name) => (
            <li
              key={name}
              className="data rounded-lg border border-denied-100 bg-denied-50 px-3 py-2 text-sm text-denied-700"
            >
              {name}
            </li>
          ))}
        </ul>

        <ol className="mt-6 space-y-3 text-sm text-ink-muted">
          <li>
            <span className="font-semibold text-navy-900">1.</span> Copy{' '}
            <code className="data rounded bg-surface px-1.5 py-0.5 text-xs">.env.example</code> to{' '}
            <code className="data rounded bg-surface px-1.5 py-0.5 text-xs">.env</code>
          </li>
          <li>
            <span className="font-semibold text-navy-900">2.</span> Paste the publishable (anon) key
            from your Supabase project · Settings → API
          </li>
          <li>
            <span className="font-semibold text-navy-900">3.</span> Restart the dev server — Vite
            only reads{' '}
            <code className="data rounded bg-surface px-1.5 py-0.5 text-xs">.env</code> at startup
          </li>
        </ol>
      </div>
    </div>
  )
}
