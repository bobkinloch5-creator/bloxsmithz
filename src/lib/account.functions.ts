import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STARTER_CREDITS = 150;
const OWNER_CREDITS = 999999;
const OWNER_EMAIL = "bobkinloch5@gmail.com";

export const repairOwnStarterCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const claims = (context as any).claims ?? {};
    const email = String(claims.email ?? "").toLowerCase();
    const displayName =
      claims.user_metadata?.display_name ??
      claims.user_metadata?.full_name ??
      (email ? email.split("@")[0] : "BloxSmith Builder");
    const avatarUrl = claims.user_metadata?.avatar_url ?? null;

    const { data: roles } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isOwner = email === OWNER_EMAIL || (roles ?? []).some((r: { role: string }) => r.role === "owner");
    const targetCredits = isOwner ? OWNER_CREDITS : STARTER_CREDITS;

    const { data: existing, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id,credits")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);

    if (!existing) {
      const referralCode =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
          : Math.random().toString(36).slice(2, 10);

      const { error: insertErr } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        email: email || `${userId}@bloxsmith.local`,
        display_name: displayName,
        avatar_url: avatarUrl,
        credits: targetCredits,
        referral_code: referralCode,
        hide_email: true,
      } as any);
      if (insertErr) throw new Error(insertErr.message);

      await supabaseAdmin.from("credit_transactions").insert({
        user_id: userId,
        amount: targetCredits,
        balance: targetCredits,
        reason: "starter",
      });
      await (supabaseAdmin as any).from("user_roles").insert({ user_id: userId, role: "user" });
      return { ok: true, credits: targetCredits, repaired: true };
    }

    const currentCredits = Number(existing.credits ?? 0);
    if (currentCredits >= targetCredits) {
      return { ok: true, credits: currentCredits, repaired: false };
    }

    const { count: spendCount, error: spendErr } = await supabaseAdmin
      .from("credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lt("amount", 0);
    if (spendErr) throw new Error(spendErr.message);

    if ((spendCount ?? 0) > 0) {
      return { ok: true, credits: currentCredits, repaired: false };
    }

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ credits: targetCredits, updated_at: new Date().toISOString() } as any)
      .eq("id", userId);
    if (updateErr) throw new Error(updateErr.message);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      amount: targetCredits - currentCredits,
      balance: targetCredits,
      reason: "starter_credit_repair",
    });

    return { ok: true, credits: targetCredits, repaired: true };
  });

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Cleanup user-owned rows (no FK cascades on these tables)
    await supabaseAdmin
      .from("project_files")
      .delete()
      .in(
        "project_id",
        (await supabaseAdmin.from("projects").select("id").eq("user_id", userId)).data?.map(
          (p) => p.id,
        ) ?? ["00000000-0000-0000-0000-000000000000"],
      );
    await supabaseAdmin.from("project_collaborators").delete().eq("user_id", userId);
    await supabaseAdmin.from("projects").delete().eq("user_id", userId);
    await supabaseAdmin.from("plugin_connections").delete().eq("user_id", userId);
    await supabaseAdmin.from("studio_errors").delete().eq("user_id", userId);
    await supabaseAdmin.from("credit_transactions").delete().eq("user_id", userId);
    await supabaseAdmin.from("payment_requests").delete().eq("user_id", userId);
    await supabaseAdmin.from("payments").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
