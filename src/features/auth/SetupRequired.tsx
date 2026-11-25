export function SetupRequired() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md rounded-lg border bg-card p-6">
        <h1 className="mb-2 font-serif text-2xl font-semibold">MakNotes</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          The backend is not configured for this build. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (or <code>src/lib/public-config.ts</code>) and rebuild. See <code>docs/SETUP.md</code>.
        </p>
      </div>
    </div>
  );
}
