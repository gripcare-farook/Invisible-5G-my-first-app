// Temporary campaign: Nov 26/27 19:30 to Nov 27/28 10:30 India time.
export function campaignConfig(env: Record<string, string | undefined>, now = new Date()) {
  if (!env.LW_CAMPAIGN) return null;
  if (env.LW_CAMPAIGN !== "black-friday-2026") throw new Error("Unknown laptop campaign");
  const ids = (env.LW_LISTING_IDS ?? "").split(",").map(x => x.trim()).filter(Boolean);
  const email = env.LW_OWNER_EMAIL?.trim().toLowerCase();
  if (ids.length !== 3 || new Set(ids).size !== 3 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Campaign requires three listings and one owner email");
  const time = now.getTime();
  const active = ["2026-11-26", "2026-11-27"].some(day => {
    const start = Date.parse(`${day}T14:00:00Z`);
    return time >= start && time < start + 15 * 60 * 60 * 1000;
  });
  return { ids, email, active };
}
