import { getSession } from "@/lib/auth";
import { HAT_LABEL, type Hat } from "@/lib/roles/hats";
import { loadHeldHats } from "@/lib/roles/server";
import { ViewingAsSelect } from "@/components/roles/ViewingAsSelect";

/**
 * "Viewing as" bar for the app shells (/org, /coach, /staff, /parent). Server component: hats come
 * from the database, never the client. Renders nothing for people with a single hat (no change for them).
 */
export async function ViewingAs({ area }: { area: Hat }) {
  let held: Awaited<ReturnType<typeof loadHeldHats>> = null;
  try {
    const session = await getSession();
    if (!session) return null;
    held = await loadHeldHats(String(session.id));
  } catch (err) {
    // Never break a dashboard over the switcher.
    console.warn("[roles] failed to load hats", err);
    return null;
  }
  if (!held || held.hats.length < 2) return null;

  const current: Hat = held.hats.includes(area) ? area : held.defaultHat ?? held.hats[0];
  return (
    <ViewingAsSelect
      current={current}
      options={held.hats.map((h) => ({ value: h, label: HAT_LABEL[h] }))}
      academyName={held.orgName}
    />
  );
}
