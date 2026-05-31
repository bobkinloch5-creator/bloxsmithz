
-- 1) Private per-user secrets table (Roblox verification code)
CREATE TABLE IF NOT EXISTS public.private_user_data (
  user_id uuid PRIMARY KEY,
  roblox_verification_code text,
  roblox_verification_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_user_data TO authenticated;
GRANT ALL ON public.private_user_data TO service_role;

ALTER TABLE public.private_user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read private data" ON public.private_user_data
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner insert private data" ON public.private_user_data
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update private data" ON public.private_user_data
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete private data" ON public.private_user_data
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Migrate existing data from profiles
INSERT INTO public.private_user_data (user_id, roblox_verification_code, roblox_verification_expires_at)
SELECT id, roblox_verification_code, roblox_verification_expires_at
FROM public.profiles
WHERE roblox_verification_code IS NOT NULL OR roblox_verification_expires_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2) Drop sensitive columns from profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS roblox_verification_code,
  DROP COLUMN IF EXISTS roblox_verification_expires_at,
  DROP COLUMN IF EXISTS email;

-- 3) Update handle_new_user trigger to not insert email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _is_owner boolean; _ref text; _starter int;
BEGIN
  _is_owner := lower(NEW.email) = 'bobkinloch5@gmail.com';
  _starter := CASE WHEN _is_owner THEN 999999 ELSE 150 END;
  _ref := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.profiles(id, display_name, avatar_url, credits, referral_code, hide_email)
    VALUES (NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
      NEW.raw_user_meta_data->>'avatar_url',
      _starter,
      _ref,
      true);
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF _is_owner THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
    VALUES (NEW.id, _starter, _starter, 'starter');
  RETURN NEW;
END $$;

-- 4) Tighten public-read policies to authenticated only
DROP POLICY IF EXISTS "user_achievements readable" ON public.user_achievements;
CREATE POLICY "user_achievements readable" ON public.user_achievements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "follows readable" ON public.user_follows;
CREATE POLICY "follows readable" ON public.user_follows
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_levels readable" ON public.user_levels;
CREATE POLICY "user_levels readable" ON public.user_levels
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prefs public read" ON public.global_chat_user_prefs;
CREATE POLICY "prefs read" ON public.global_chat_user_prefs
  FOR SELECT TO authenticated USING (true);

-- 5) Storage policies for generated-images bucket (owner-scoped writes by first folder segment)
CREATE POLICY "users upload own generated images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users update own generated images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own generated images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]);
