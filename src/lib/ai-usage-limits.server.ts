import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AiUsageLimitResult =
  | { limited: false; used: number; limit: number; resetAt: string | null; bypassed: boolean }
  | { limited: true; used: number; limit: number; resetAt: string; bypassed: false };

const DEFAULT_DAILY_LIMIT = 40;
const DEFAULT_WINDOW_HOURS = 24;

type RoleReader = {
  from(table: "user_roles"): {
    select(columns: string): {
      eq(column: string, value: string): PromiseLike<{ data: Array<{ role: string }> | null }>;
    };
  };
};

type RateLimitTable = {
  select(
    columns: string,
    options?: { count?: "exact" },
  ): {
    eq(
      column: string,
      value: string,
    ): {
      gte(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          options: { ascending: boolean },
        ): {
          limit(count: number): Promise<{
            count: number | null;
            data: Array<{ created_at: string }> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
  insert(row: {
    user_id: string;
    source: string;
    metadata: Record<string, unknown>;
  }): Promise<{ error?: { message?: string } | null }>;
};

function rateLimitTable() {
  return (supabaseAdmin as unknown as { from(table: "ai_rate_limit_events"): RateLimitTable }).from(
    "ai_rate_limit_events",
  );
}

function limitConfig() {
  const limit = Number(process.env.AI_DAILY_REQUEST_LIMIT || DEFAULT_DAILY_LIMIT);
  const windowHours = Number(process.env.AI_DAILY_WINDOW_HOURS || DEFAULT_WINDOW_HOURS);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_DAILY_LIMIT,
    windowHours:
      Number.isFinite(windowHours) && windowHours > 0
        ? Math.floor(windowHours)
        : DEFAULT_WINDOW_HOURS,
  };
}

export async function userBypassesAiLimit(userId: string, supabase: unknown): Promise<boolean> {
  try {
    const roleReader = supabase as RoleReader;
    const { data } = await roleReader.from("user_roles").select("role").eq("user_id", userId);
    return (data ?? []).some((r: { role: string }) =>
      ["owner", "admin", "moderator"].includes(r.role),
    );
  } catch {
    return false;
  }
}

function resetFromOldest(oldest: string | null | undefined, windowHours: number) {
  if (!oldest) return null;
  const time = Date.parse(oldest);
  if (!Number.isFinite(time)) return null;
  return new Date(time + windowHours * 60 * 60 * 1000).toISOString();
}

export async function checkAiUsageLimit(opts: {
  userId: string;
  supabase: unknown;
}): Promise<AiUsageLimitResult> {
  const bypassed = await userBypassesAiLimit(opts.userId, opts.supabase);
  const { limit, windowHours } = limitConfig();
  if (bypassed) return { limited: false, used: 0, limit, resetAt: null, bypassed: true };

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const { count, data, error } = await rateLimitTable()
    .select("created_at", { count: "exact" })
    .eq("user_id", opts.userId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error && !/relation .*ai_rate_limit_events.* does not exist/i.test(error.message ?? "")) {
    console.warn("[ai-limit] count failed:", error.message);
  }

  const used = count ?? 0;
  const resetAt = resetFromOldest(
    (data as Array<{ created_at: string }> | null)?.[0]?.created_at,
    windowHours,
  );
  if (used >= limit) {
    return {
      limited: true,
      used,
      limit,
      resetAt: resetAt ?? new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString(),
      bypassed: false,
    };
  }
  return { limited: false, used, limit, resetAt, bypassed: false };
}

export async function recordAiLimitUse(opts: {
  userId: string;
  supabase: unknown;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  if (await userBypassesAiLimit(opts.userId, opts.supabase)) return;
  try {
    await rateLimitTable().insert({
      user_id: opts.userId,
      source: opts.source,
      metadata: opts.metadata ?? {},
    } as any);
  } catch (error) {
    console.warn("[ai-limit] record failed:", error instanceof Error ? error.message : error);
  }
}

export async function enforceAiUsageLimit(opts: {
  userId: string;
  supabase: unknown;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  const status = await checkAiUsageLimit(opts);
  if (status.limited) {
    const reset = new Date(status.resetAt).toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
    });
    throw new Error(
      `Daily AI limit reached (${status.used}/${status.limit}). Your timer resets ${reset}.`,
    );
  }
  await recordAiLimitUse(opts);
  return status;
}
