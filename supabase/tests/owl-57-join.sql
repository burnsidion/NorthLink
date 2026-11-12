\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(command text, expected_state text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected % for %',expected_state,command;
END $$;

SET LOCAL ROLE anon;
SELECT pg_temp.expect_error($cmd$SELECT public.join_group_by_invite_code('ABCDEFGH')$cmd$,'42501');
SELECT pg_temp.expect_error($cmd$SELECT public.create_group_with_code('Forbidden')$cmd$,'42501');
SELECT pg_temp.expect_error($cmd$SELECT northlink_private.join_group_by_invite_code('ABCDEFGH')$cmd$,'42501');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.expect_error($cmd$SELECT public.join_group_by_invite_code('ABCDEFGH')$cmd$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
SELECT pg_temp.expect_error($cmd$SELECT public.join_group_by_invite_code('ABCDEFGH')$cmd$,'42501');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.groups WHERE id='00000000-0000-0000-0000-000000000011'),'outsider cannot discover group/code');
SELECT pg_temp.expect_error($cmd$SELECT public.join_group_by_invite_code(NULL)$cmd$,'22023');
SELECT pg_temp.expect_error($cmd$SELECT public.join_group_by_invite_code('')$cmd$,'22023');
SELECT pg_temp.expect_error($cmd$SELECT public.join_group_by_invite_code('ZZZZZZZZ')$cmd$,'22023');
SELECT pg_temp.expect_error($cmd$SELECT public.join_group_by_invite_code('00000000-0000-0000-0000-000000000011')$cmd$,'22023');
SELECT pg_temp.expect_error($cmd$SELECT public.join_group_by_invite_code('ABCDEFGH'' OR true --')$cmd$,'22023');
SELECT pg_temp.expect_error($cmd$INSERT INTO public.group_members(group_id,user_id,role) VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000003','owner')$cmd$,'42501');
SELECT pg_temp.expect_error($cmd$INSERT INTO public.group_members(group_id,user_id,role) VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000003','member')$cmd$,'42501');
SELECT pg_temp.assert_true(public.join_group_by_invite_code('  abcdefgh  ')='00000000-0000-0000-0000-000000000011','short code joins correct group');
SELECT pg_temp.assert_true((SELECT role FROM public.group_members WHERE group_id='00000000-0000-0000-0000-000000000011' AND user_id=auth.uid())='member','caller joins as member');
SELECT pg_temp.assert_true(public.join_group_by_invite_code('ABCDEFGH')='00000000-0000-0000-0000-000000000011','repeat join succeeds');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.group_members WHERE group_id='00000000-0000-0000-0000-000000000011' AND user_id=auth.uid())=1,'no duplicate membership');
SELECT pg_temp.expect_error($cmd$UPDATE public.group_members SET role='owner' WHERE user_id=auth.uid()$cmd$,'42501');
SELECT pg_temp.expect_error($cmd$INSERT INTO public.group_members(group_id,user_id,role) VALUES ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000004','owner')$cmd$,'42501');
SELECT pg_temp.assert_true(public.join_group_by_invite_code('JKLMNPQR')='00000000-0000-0000-0000-000000000012','second group permitted');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.group_members WHERE user_id=auth.uid())=2,'both memberships preserved');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT public.join_group_by_invite_code('ABCDEFGH');
SELECT pg_temp.assert_true((SELECT role FROM public.group_members WHERE group_id='00000000-0000-0000-0000-000000000011' AND user_id=auth.uid())='owner','repeat join preserves owner');
SELECT pg_temp.expect_error($cmd$INSERT INTO public.group_members(group_id,user_id,role) VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000003','admin')$cmd$,'42501');
DO $$ DECLARE created public.groups; BEGIN
  created := public.create_group_with_code('New test family');
  IF created.owner_user_id IS DISTINCT FROM auth.uid()
     OR created.invite_code IS NULL
     OR created.invite_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
     OR NOT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=created.id AND user_id=auth.uid() AND role='owner')
  THEN RAISE EXCEPTION 'Group creation/owner membership failed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
SELECT public.join_group_by_invite_code('ABCDEFGH');
SELECT pg_temp.assert_true((SELECT role FROM public.group_members WHERE group_id='00000000-0000-0000-0000-000000000011' AND user_id=auth.uid())='admin','repeat join preserves admin');
SELECT pg_temp.expect_error($cmd$UPDATE public.group_members SET role='owner' WHERE user_id=auth.uid()$cmd$,'42501');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.group_members','INSERT'),'direct insert grant absent');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.group_members','UPDATE'),'direct update grant absent');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.join_group_by_invite_code(text)','EXECUTE'),'anonymous RPC execution absent');
SELECT pg_temp.assert_true(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.join_group_by_invite_code(text)'::regprocedure),'public wrapper is unprivileged');
SELECT pg_temp.assert_true((SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid='northlink_private.join_group_by_invite_code(text)'::regprocedure),'private search path fixed');
ROLLBACK;
\echo OWL-57 invitation checks passed
