import { saveNotificationPreferences } from "@/app/actions/notification-prefs";
import { PREFERENCE_CATEGORIES, PREFERENCE_CHANNELS } from "@/lib/messaging/preferences";
import { buttonCls } from "@/components/verticals/ui";

/** Channel x category grid of checkboxes. Fees are locked on; email is shown but not sent yet. */
export function PreferencesForm({ grid, disabled }: { grid: Record<string, Record<string, boolean>>; disabled?: boolean }) {
  return (
    <form action={saveNotificationPreferences} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-400">
              <th className="py-2 pr-4 font-medium">Category</th>
              {PREFERENCE_CHANNELS.map((ch) => (
                <th key={ch.key} className="px-3 py-2 text-center font-medium">
                  {ch.label}
                  {!ch.available && <span className="block text-[10px] font-normal text-zinc-500">coming soon</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {PREFERENCE_CATEGORIES.map((c) => (
              <tr key={c.key}>
                <td className="py-3 pr-4">
                  <div className="font-medium text-zinc-100">{c.label}</div>
                  <div className="text-xs text-zinc-500">{c.hint}</div>
                </td>
                {PREFERENCE_CHANNELS.map((ch) => {
                  const on = grid[ch.key]?.[c.key] ?? true;
                  return (
                    <td key={ch.key} className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        name={`pref:${ch.key}:${c.key}`}
                        defaultChecked={c.locked ? true : on}
                        disabled={disabled || c.locked}
                        aria-label={`${c.label} on ${ch.label}`}
                        className="h-4 w-4 accent-lime-400"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Fee notices and safety alerts (SOS, incidents) are always sent.</p>
      <button type="submit" className={buttonCls} disabled={disabled}>
        Save preferences
      </button>
    </form>
  );
}
