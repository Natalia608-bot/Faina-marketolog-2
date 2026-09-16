export const AREAS = ["core", "publishing", "replies"] as const;
export type Area = (typeof AREAS)[number];

export function isArea(s: string): s is Area {
  return (AREAS as readonly string[]).includes(s);
}

// Product slug → entitled areas. `core` is implied everywhere but listed for clarity. A slug not in
// this map is treated as all-access (a self-hoster's custom slug must never be silently locked out).
const SLUG_AREAS: Record<string, readonly Area[]> = {
  faina: ["core", "publishing", "replies"],
  "faina-publishing": ["core", "publishing"],
  "faina-replies": ["core", "replies"],
};

/** Areas a single product slug entitles, or null if the slug is unknown (caller decides the default). */
export function slugAreas(slug: string): Set<Area> | null {
  const a = SLUG_AREAS[slug.trim()];
  return a ? new Set(a) : null;
}

/** Union of areas across a comma-separated allowlist of slugs (an install accepting several products). */
export function allowlistAreas(csv: string): Set<Area> {
  const out = new Set<Area>();
  for (const slug of csv.split(",").map((s) => s.trim()).filter(Boolean)) {
    const a = slugAreas(slug);
    if (a) for (const area of a) out.add(area);
  }
  return out;
}
