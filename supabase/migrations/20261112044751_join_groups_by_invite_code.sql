-- OWL-57 checkpoint 1: accept invitations without trusting client identity/role.
-- Apply after OWL-55; no existing memberships or invite codes are rewritten.
BEGIN;

CREATE SCHEMA IF NOT EXISTS northlink_private;
REVOKE ALL ON SCHEMA northlink_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA northlink_private TO authenticated;

-- Privileged only because joining must find a group before membership exists.
-- Keep this schema outside the Data API exposed schemas.
CREATE OR REPLACE FUNCTION northlink_private.join_group_by_invite_code(p_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  code text := pg_catalog.upper(pg_catalog.btrim(p_invite_code));
  target_group uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Sign in before joining a family group.' USING ERRCODE = '42501';
  END IF;

  -- Require a real account, including when called outside the normal API.
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = caller) THEN
    RAISE EXCEPTION 'Sign in before joining a family group.' USING ERRCODE = '42501';
  END IF;

  IF code IS NULL OR code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' THEN
    RAISE EXCEPTION 'Invalid invite code.' USING ERRCODE = '22023';
  END IF;

  SELECT g.id INTO target_group
  FROM public.groups g WHERE g.invite_code = code
  FOR KEY SHARE;
  IF target_group IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.group_members(group_id, user_id, role)
  VALUES (target_group, caller, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  -- Repeat/concurrent joins never demote owners/admins or duplicate membership.
  RETURN target_group;
END;
$$;
REVOKE ALL ON FUNCTION northlink_private.join_group_by_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION northlink_private.join_group_by_invite_code(text) TO authenticated;

-- Thin API entry point: no caller-supplied user ID, group ID, or role.
CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(p_invite_code text)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT northlink_private.join_group_by_invite_code(p_invite_code);
$$;
REVOKE ALL ON FUNCTION public.join_group_by_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_by_invite_code(text) TO authenticated;

-- There is no membership/role editor in the app. Close direct writes rather
-- than leaving the old permissive policies as a bypass around invitations.
REVOKE INSERT, UPDATE ON public.group_members FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Users can join existing groups" ON public.group_members;
DROP POLICY IF EXISTS "group_members: owner/admin can insert" ON public.group_members;
DROP POLICY IF EXISTS "group_members: owner/admin can update roles" ON public.group_members;

-- Group creation still inserts its owner through the existing trusted function.
ALTER FUNCTION public.create_group_with_code(text) SET search_path = '';
REVOKE ALL ON FUNCTION public.create_group_with_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_code(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
