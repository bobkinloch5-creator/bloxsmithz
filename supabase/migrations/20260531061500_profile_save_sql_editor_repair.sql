-- SQL-editor-safe profile save repair.
-- This re-applies the profile bootstrap RPC with complete one-line conflict
-- clauses so Supabase/Lovable users do not accidentally run a detached
-- "ON CONFLICT DO NOTHING" fragment while repairing profile settings.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS username_normalized text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS specialization text,
  ADD COLUMN IF NOT EXISTS credits integer DEFAULT 150,
  ADD COLUMN IF NOT EXISTS hide_email boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_name_gradient text[],
  ADD COLUMN IF NOT EXISTS chat_text_gradient text[],
  ADD COLUMN IF NOT EXISTS chat_icon text,
  ADD COLUMN IF NOT EXISTS chat_nickname text,
  ADD COLUMN IF NOT EXISTS chat_font text,
  ADD COLUMN IF NOT EXISTS profile_accent text,
  ADD COLUMN IF NOT EXISTS profile_card_color text DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS profile_card_effect text DEFAULT 'soft_glow',
  ADD COLUMN IF NOT EXISTS profile_effect text,
  ADD COLUMN IF NOT EXISTS profile_background text,
  ADD COLUMN IF NOT EXISTS custom_background_url text,
  ADD COLUMN IF NOT EXISTS profile_layout text DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS pfp_effect text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS status_message text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS private_profile boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS presence_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS presence_status text DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS show_activity boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_badges text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_decoration text DEFAULT 'none';

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ensure_profile$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt()->>'email', ''));
  _safe_email text;
  _name text := coalesce(
    auth.jwt()->'user_metadata'->>'display_name',
    auth.jwt()->'user_metadata'->>'full_name',
    nullif(split_part(coalesce(auth.jwt()->>'email', ''), '@', 1), ''),
    'BloxSmith Builder'
  );
  _avatar text := auth.jwt()->'user_metadata'->>'avatar_url';
  _is_owner boolean;
  _starter int;
  _old_credits int;
  _inserted int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _safe_email := coalesce(nullif(_email, ''), _uid::text || '@bloxsmith.local');
  _is_owner := _email = 'bobkinloch5@gmail.com';
  _starter := CASE WHEN _is_owner THEN 999999 ELSE 150 END;

  INSERT INTO public.profiles(id, email, display_name, avatar_url, credits, referral_code, hide_email) VALUES (_uid, _safe_email, _name, _avatar, _starter, substr(md5(_uid::text), 1, 8), true) ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted = 0 THEN
    SELECT credits INTO _old_credits
      FROM public.profiles
     WHERE id = _uid
     FOR UPDATE;

    UPDATE public.profiles
       SET email = coalesce(nullif(_email, ''), email, _safe_email),
           display_name = coalesce(display_name, _name),
           avatar_url = coalesce(avatar_url, _avatar),
           credits = CASE
             WHEN COALESCE(credits, 0) < _starter
              AND NOT EXISTS (
                SELECT 1 FROM public.credit_transactions t
                 WHERE t.user_id = _uid
                   AND t.amount < 0
              )
             THEN _starter
             ELSE COALESCE(credits, _starter)
           END,
           updated_at = now()
     WHERE id = _uid;

    IF COALESCE(_old_credits, 0) < _starter
       AND NOT EXISTS (
         SELECT 1 FROM public.credit_transactions t
          WHERE t.user_id = _uid
            AND t.amount < 0
       ) THEN
      INSERT INTO public.credit_transactions(user_id, amount, balance, reason) VALUES (_uid, _starter - COALESCE(_old_credits, 0), _starter, 'starter_credit_repair');
    END IF;
  ELSE
    INSERT INTO public.credit_transactions(user_id, amount, balance, reason) VALUES (_uid, _starter, _starter, 'starter');
  END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'user') ON CONFLICT DO NOTHING;

  IF _is_owner THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END;
$ensure_profile$;

REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

NOTIFY pgrst, 'reload schema';
