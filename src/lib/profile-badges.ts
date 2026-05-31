export const PROFILE_BADGE_IDS = [
  "founder",
  "early",
  "developer",
  "verified",
  "supporter",
  "booster",
  "legend",
  "creator",
  "translator",
  "bug_hunter",
  "staff",
  "moderator",
  "og",
  "nitro",
  "active",
  "explorer",
  "artist",
  "scripter",
] as const;

export type ProfileBadgeId = (typeof PROFILE_BADGE_IDS)[number];

export const LOCKED_PROFILE_BADGE_IDS = [
  "founder",
  "verified",
  "staff",
  "moderator",
] as const satisfies readonly ProfileBadgeId[];

export const SELECTABLE_PROFILE_BADGE_IDS = PROFILE_BADGE_IDS.filter(
  (id) => !LOCKED_PROFILE_BADGE_IDS.includes(id as (typeof LOCKED_PROFILE_BADGE_IDS)[number]),
) as ProfileBadgeId[];

const BADGE_ID_SET = new Set<string>(PROFILE_BADGE_IDS);
const SELECTABLE_BADGE_ID_SET = new Set<string>(SELECTABLE_PROFILE_BADGE_IDS);

export function normalizeProfileBadgeIds(ids: unknown, max = 12): ProfileBadgeId[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.map(String)))
    .filter((id): id is ProfileBadgeId => BADGE_ID_SET.has(id))
    .slice(0, max);
}

export function selectableProfileBadgeIds(ids: unknown, max = 12): ProfileBadgeId[] {
  return normalizeProfileBadgeIds(ids, max).filter((id) => SELECTABLE_BADGE_ID_SET.has(id));
}

export function roleProfileBadgeIds(roles: readonly string[] | null | undefined): ProfileBadgeId[] {
  const set = new Set((roles ?? []).map(String));
  const ids: ProfileBadgeId[] = [];
  if (set.has("owner")) ids.push("founder");
  if (set.has("owner") || set.has("admin")) ids.push("staff");
  if (set.has("moderator")) ids.push("moderator");
  if (set.has("owner") || set.has("admin") || set.has("moderator")) ids.push("verified");
  return ids;
}

export function mergeProfileBadgeIds(
  ids: Array<string | null | undefined>,
  max = 12,
): ProfileBadgeId[] {
  return normalizeProfileBadgeIds(ids.filter(Boolean), max);
}
