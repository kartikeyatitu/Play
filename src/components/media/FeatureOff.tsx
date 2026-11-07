/** Shown while FEATURES.media is off: the Media* tables are not queried. */
export function MediaFeatureOff() {
  return (
    <main className="mx-auto max-w-lg px-4 py-10 text-center">
      <h1 className="text-lg font-semibold text-ink">Photos are coming soon</h1>
      <p className="mt-2 text-sm text-ink-muted">This feature is not switched on yet.</p>
    </main>
  );
}
