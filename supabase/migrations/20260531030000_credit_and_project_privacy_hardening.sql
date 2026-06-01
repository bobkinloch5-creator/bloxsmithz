-- Repair starter-credit accounts and make project data owner-only.

ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 150;

-- If an account has never spent credits, it should never be stuck below the
-- current starter grant. This repairs older/buggy rows without refunding users
-- who already have real spend history.
WITH eligible AS (
  SELECT
    p.id,
    p.credits AS old_credits,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles r
        WHERE r.user_id = p.id
          AND r.role = 'owner'
      )
      THEN 999999
      ELSE 150
    END AS target_credits
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions t
    WHERE t.user_id = p.id
      AND t.amount < 0
  )
),
repaired AS (
  UPDATE public.profiles p
     SET credits = e.target_credits,
         updated_at = now()
    FROM eligible e
   WHERE p.id = e.id
     AND p.credits < e.target_credits
  RETURNING p.id, e.old_credits, p.credits
)
INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
SELECT id, credits - old_credits, credits, 'starter_credit_repair'
FROM repaired
WHERE credits > old_credits;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean;
  _ref text;
  _starter int;
BEGIN
  _is_owner := lower(NEW.email) = 'bobkinloch5@gmail.com';
  _starter := CASE WHEN _is_owner THEN 999999 ELSE 150 END;
  _ref := lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

  INSERT INTO public.profiles(id, email, display_name, avatar_url, credits, referral_code, hide_email)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    _starter,
    _ref,
    true
  );

  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  IF _is_owner THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
  VALUES (NEW.id, _starter, _starter, 'starter');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
  _row_count int := 0;
  _starter int;
  _ref text;
  _old_credits int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _safe_email := coalesce(nullif(_email, ''), _uid::text || '@bloxsmith.local');
  _is_owner := _email = 'bobkinloch5@gmail.com';
  _starter := CASE WHEN _is_owner THEN 999999 ELSE 150 END;
  _ref := lower(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  INSERT INTO public.profiles(id, email, display_name, avatar_url, credits, referral_code, hide_email)
  VALUES (_uid, _safe_email, _name, _avatar, _starter, _ref, true)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS _row_count = ROW_COUNT;

  IF _row_count = 0 THEN
    SELECT credits INTO _old_credits
    FROM public.profiles
    WHERE id = _uid
    FOR UPDATE;

    UPDATE public.profiles
       SET email = coalesce(nullif(_email, ''), email),
           display_name = coalesce(display_name, _name),
           avatar_url = coalesce(avatar_url, _avatar),
           credits = CASE
             WHEN credits < _starter
              AND NOT EXISTS (
                SELECT 1
                FROM public.credit_transactions t
                WHERE t.user_id = _uid
                  AND t.amount < 0
              )
             THEN _starter
             ELSE credits
           END,
           updated_at = now()
     WHERE id = _uid;

    IF _old_credits < _starter
       AND NOT EXISTS (
         SELECT 1
         FROM public.credit_transactions t
         WHERE t.user_id = _uid
           AND t.amount < 0
       ) THEN
      INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
      VALUES (_uid, _starter - _old_credits, _starter, 'starter_credit_repair');
    END IF;
  ELSE
    INSERT INTO public.credit_transactions(user_id, amount, balance, reason)
    VALUES (_uid, _starter, _starter, 'starter');
  END IF;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (_uid, 'user')
  ON CONFLICT DO NOTHING;

  IF _is_owner THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

-- Disable all project sharing/public showcase access.
UPDATE public.projects
   SET showcase_published = false,
       showcase_published_at = NULL,
       updated_at = now()
 WHERE showcase_published = true;

DELETE FROM public.project_collaborators;

CREATE OR REPLACE FUNCTION public.can_access_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "public reads showcased projects" ON public.projects;
DROP POLICY IF EXISTS "owners and collabs read projects" ON public.projects;
DROP POLICY IF EXISTS "projects_collab_read" ON public.projects;
DROP POLICY IF EXISTS "projects_owner_all" ON public.projects;
DROP POLICY IF EXISTS "users insert own projects" ON public.projects;
DROP POLICY IF EXISTS "owners update projects" ON public.projects;
DROP POLICY IF EXISTS "owners delete projects" ON public.projects;
DROP POLICY IF EXISTS "projects select owner only" ON public.projects;
DROP POLICY IF EXISTS "projects insert owner only" ON public.projects;
DROP POLICY IF EXISTS "projects update owner only" ON public.projects;
DROP POLICY IF EXISTS "projects delete owner only" ON public.projects;

CREATE POLICY "projects select owner only"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "projects insert owner only"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects update owner only"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects delete owner only"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE SELECT ON public.projects FROM anon;

DROP POLICY IF EXISTS "files_access" ON public.project_files;
DROP POLICY IF EXISTS "members read files" ON public.project_files;
DROP POLICY IF EXISTS "members write files" ON public.project_files;
DROP POLICY IF EXISTS "project owners read files" ON public.project_files;
DROP POLICY IF EXISTS "project owners write files" ON public.project_files;
DROP POLICY IF EXISTS "project files select owner only" ON public.project_files;
DROP POLICY IF EXISTS "project files insert owner only" ON public.project_files;
DROP POLICY IF EXISTS "project files update owner only" ON public.project_files;
DROP POLICY IF EXISTS "project files delete owner only" ON public.project_files;

CREATE POLICY "project files select owner only"
  ON public.project_files
  FOR SELECT
  TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "project files insert owner only"
  ON public.project_files
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "project files update owner only"
  ON public.project_files
  FOR UPDATE
  TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()))
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "project files delete owner only"
  ON public.project_files
  FOR DELETE
  TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()));

DROP POLICY IF EXISTS "collab_read_self_or_owner" ON public.project_collaborators;
DROP POLICY IF EXISTS "collab_owner_manage" ON public.project_collaborators;
DROP POLICY IF EXISTS "members read collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "owners manage collaborators" ON public.project_collaborators;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.project_collaborators FROM authenticated;

DROP POLICY IF EXISTS "anyone reads likes" ON public.showcase_likes;
DROP POLICY IF EXISTS "users like own" ON public.showcase_likes;
DROP POLICY IF EXISTS "users unlike own" ON public.showcase_likes;
DROP POLICY IF EXISTS "showcase likes owner read" ON public.showcase_likes;

REVOKE SELECT ON public.showcase_likes FROM anon;

CREATE POLICY "showcase likes owner read"
  ON public.showcase_likes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.remix_showcase_project(_source_id uuid, _new_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Project sharing is disabled. Projects are private to their owner.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remix_showcase_project(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.remix_showcase_project(uuid, text) TO authenticated;
