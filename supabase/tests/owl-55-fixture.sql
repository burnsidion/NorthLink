-- Structure-only fixture from review/owl-55-before.json.
-- auth.users/auth.uid are minimal stand-ins; use only in a disposable database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
CREATE TABLE public.profiles (
"id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"display_name" text NOT NULL,
"avatar_url" text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
CREATE TABLE public.items (
"purchased_at" timestamp with time zone,
"most_wanted" boolean NOT NULL DEFAULT false,
"on_sale" boolean NOT NULL DEFAULT false,
"id" uuid NOT NULL DEFAULT gen_random_uuid(),
"list_id" uuid NOT NULL,
"price_cents" integer,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"purchased" boolean NOT NULL DEFAULT false,
"purchased_by" uuid,
"link" text,
"title" text NOT NULL,
"url" text,
"image_url" text,
"notes" text,
"priority" text DEFAULT 'medium'::text
);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon, authenticated;
CREATE TABLE public.claims (
"id" uuid NOT NULL DEFAULT gen_random_uuid(),
"item_id" uuid NOT NULL,
"claimer_user_id" uuid NOT NULL,
"is_anonymous" boolean NOT NULL DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"purchased_at" timestamp with time zone,
"status" text NOT NULL,
"note" text
);
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO anon, authenticated;
CREATE TABLE public.families (
"id" uuid NOT NULL DEFAULT gen_random_uuid(),
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"name" text NOT NULL
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO anon, authenticated;
CREATE TABLE public.family_members (
"family_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"role" text NOT NULL DEFAULT 'member'::text
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO anon, authenticated;
CREATE TABLE public.groups (
"id" uuid NOT NULL DEFAULT gen_random_uuid(),
"owner_user_id" uuid NOT NULL,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"invite_code" text,
"name" text NOT NULL
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO anon, authenticated;
CREATE TABLE public.group_members (
"joined_at" timestamp with time zone NOT NULL DEFAULT now(),
"group_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"role" text NOT NULL
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO anon, authenticated;
CREATE TABLE public.lists (
"id" uuid NOT NULL DEFAULT gen_random_uuid(),
"owner_user_id" uuid NOT NULL DEFAULT auth.uid(),
"year" integer NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"family_id" uuid NOT NULL,
"last_viewed_at" timestamp with time zone,
"title" text NOT NULL DEFAULT 'My Christmas List'::text
);
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lists TO anon, authenticated;
CREATE TABLE public.list_shares (
"list_id" uuid NOT NULL,
"group_id" uuid NOT NULL,
"shared_at" timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.list_shares ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_shares TO anon, authenticated;
CREATE OR REPLACE FUNCTION public._gen_invite_code(len integer DEFAULT 8)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out_code text := '';
  i int;
begin
  if len < 6 then
    len := 6; -- minimum length
  end if;

  for i in 1..len loop
    out_code := out_code || substr(alphabet, 1 + (floor(random()*length(alphabet)))::int, 1);
  end loop;

  return out_code;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.assign_unique_invite_code(gid uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  candidate text;
  tries int := 0;
begin
  loop
    candidate := public._gen_invite_code(8);
    begin
      update public.groups
         set invite_code = candidate
       where id = gid
         and invite_code is null;
      if found then
        return candidate;
      end if;
    exception when unique_violation then
      -- collision; retry
      tries := tries + 1;
      if tries > 10 then
        raise exception 'Could not generate unique invite code after 10 tries';
      end if;
    end;
  end loop;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_group_with_code(p_name text)
 RETURNS groups
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  me uuid;
  g public.groups;
begin
  -- who’s calling
  select auth.uid() into me;
  if me is null then
    raise exception 'not authenticated';
  end if;

  insert into public.groups(name, owner_user_id)
  values (p_name, me)
  returning * into g;

  perform public.assign_unique_invite_code(g.id);

  -- add owner to group_members
  insert into public.group_members(group_id, user_id, role)
  values (g.id, me, 'owner')
  on conflict do nothing;

  select * into g from public.groups where id = g.id;
  return g;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_user_in_group(gid uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.group_members
    where group_id = gid
      and user_id  = uid
  );
$function$
;
CREATE OR REPLACE FUNCTION public.moddatetime()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_default_family_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select id from families order by created_at asc limit 1
$function$
;
CREATE OR REPLACE FUNCTION public.set_lists_owner_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.owner_user_id is null then
      new.owner_user_id := auth.uid();
    end if;
  elsif tg_op = 'UPDATE' then
    -- never allow changing the owner
    if new.owner_user_id is distinct from old.owner_user_id then
      new.owner_user_id := old.owner_user_id;
    end if;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_family_member(f uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists(
    select 1
    from public.family_members
    where family_id = f
      and user_id = auth.uid()
  );
$function$
;
CREATE OR REPLACE FUNCTION public.on_profiles_insert_create_family()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.ensure_family_for_user(NEW.id, coalesce(NEW.display_name, 'My Family'));
  return NEW;
end
$function$
;
CREATE OR REPLACE FUNCTION public.set_list_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- prefer explicit owner if provided; otherwise use auth.uid()
  new.owner_user_id := coalesce(new.owner_user_id, auth.uid());

  if new.owner_user_id is null then
    -- We’re probably running as postgres in the SQL editor.
    raise exception 'owner_user_id is required when running without auth context';
  end if;

  if new.family_id is null then
    new.family_id := public.ensure_family_for_user(new.owner_user_id, null);
  end if;

  if new.title is null then
    new.title := 'My Christmas List';
  end if;

  if new.year is null then
    new.year := extract(year from now())::int;
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_member(u uuid, gid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.group_members gm
    where gm.user_id = u
      and gm.group_id = gid
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.user_id = uid
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_group_owner(gid uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.groups g
    where g.id = gid and g.owner_user_id = uid
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_group_admin_or_owner(gid uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    exists (
      select 1 from public.group_members gm
      where gm.group_id = gid
        and gm.user_id  = uid
        and gm.role in ('owner','admin')
    )
    or exists (
      select 1 from public.groups g
      where g.id = gid and g.owner_user_id = uid
    );
$function$
;
CREATE OR REPLACE FUNCTION public.ensure_family_for_user(uid uuid, family_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_family_id uuid;
  v_name text := coalesce(family_name, 'Family ' || left(uid::text, 8));
begin
  -- reuse existing family if present
  select fm.family_id
    into v_family_id
    from public.family_members fm
   where fm.user_id = uid
   limit 1;

  if v_family_id is null then
    insert into public.families (name)
    values (v_name)
    returning id into v_family_id;

    insert into public.family_members (family_id, user_id, role)
    values (v_family_id, uid, 'owner')
    on conflict do nothing;
  end if;

  return v_family_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;
ALTER TABLE profiles ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE profiles ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE lists ADD CONSTRAINT "lists_pkey" PRIMARY KEY (id);
ALTER TABLE lists ADD CONSTRAINT "lists_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE items ADD CONSTRAINT "items_price_cents_check" CHECK ((price_cents >= 0));
ALTER TABLE items ADD CONSTRAINT "items_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
ALTER TABLE items ADD CONSTRAINT "items_pkey" PRIMARY KEY (id);
ALTER TABLE items ADD CONSTRAINT "items_list_id_fkey" FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE;
ALTER TABLE claims ADD CONSTRAINT "claims_status_check" CHECK ((status = ANY (ARRAY['reserved'::text, 'purchased'::text])));
ALTER TABLE claims ADD CONSTRAINT "claims_pkey" PRIMARY KEY (id);
ALTER TABLE claims ADD CONSTRAINT "claims_item_id_fkey" FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE claims ADD CONSTRAINT "claims_claimer_user_id_fkey" FOREIGN KEY (claimer_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE families ADD CONSTRAINT "families_pkey" PRIMARY KEY (id);
ALTER TABLE family_members ADD CONSTRAINT "family_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])));
ALTER TABLE family_members ADD CONSTRAINT "family_members_pkey" PRIMARY KEY (family_id, user_id);
ALTER TABLE family_members ADD CONSTRAINT "family_members_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE family_members ADD CONSTRAINT "family_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE lists ADD CONSTRAINT "lists_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL;
ALTER TABLE groups ADD CONSTRAINT "groups_pkey" PRIMARY KEY (id);
ALTER TABLE groups ADD CONSTRAINT "groups_invite_code_key" UNIQUE (invite_code);
ALTER TABLE group_members ADD CONSTRAINT "group_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])));
ALTER TABLE group_members ADD CONSTRAINT "group_members_pkey" PRIMARY KEY (group_id, user_id);
ALTER TABLE group_members ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE list_shares ADD CONSTRAINT "list_shares_pkey" PRIMARY KEY (list_id, group_id);
ALTER TABLE list_shares ADD CONSTRAINT "list_shares_list_id_fkey" FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE;
ALTER TABLE list_shares ADD CONSTRAINT "list_shares_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE items ADD CONSTRAINT "items_purchased_by_fkey" FOREIGN KEY (purchased_by) REFERENCES profiles(id);
CREATE VIEW public.list_progress AS  SELECT l.id AS list_id,
    count(i.*) AS total_items,
    COALESCE(sum(i.purchased::integer), 0::bigint) AS purchased_items
   FROM lists l
     LEFT JOIN items i ON i.list_id = l.id
  GROUP BY l.id;
GRANT ALL ON public.list_progress TO anon, authenticated;
CREATE VIEW public.v_user_accessible_lists AS  SELECT l.id,
    l.title,
    l.owner_user_id,
    p.display_name AS owner_display_name,
    l.created_at,
    gm.user_id AS shared_user_id,
    p.avatar_url AS owner_avatar_url
   FROM lists l
     LEFT JOIN profiles p ON p.id = l.owner_user_id
     LEFT JOIN list_shares ls ON ls.list_id = l.id
     LEFT JOIN group_members gm ON gm.group_id = ls.group_id;
GRANT ALL ON public.v_user_accessible_lists TO anon, authenticated;
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO public WITH CHECK ((id = auth.uid()));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO public USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "items_cud_list_owner" ON public.items FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM lists l
  WHERE ((l.id = items.list_id) AND (l.owner_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM lists l
  WHERE ((l.id = items.list_id) AND (l.owner_user_id = auth.uid())))));
CREATE POLICY "claims_update_delete_self" ON public.claims FOR UPDATE TO public USING ((claimer_user_id = auth.uid())) WITH CHECK ((claimer_user_id = auth.uid()));
CREATE POLICY "claims_delete_self" ON public.claims FOR DELETE TO public USING ((claimer_user_id = auth.uid()));
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "families_select_mine" ON public.families FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM family_members fm
  WHERE ((fm.family_id = families.id) AND (fm.user_id = auth.uid())))));
CREATE POLICY "fm_insert_self" ON public.family_members FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "groups: owner may delete" ON public.groups FOR DELETE TO authenticated USING ((owner_user_id = auth.uid()));
CREATE POLICY "families_select_by_membership" ON public.families FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM family_members m
  WHERE ((m.family_id = families.id) AND (m.user_id = auth.uid())))));
CREATE POLICY "families_insert_auth" ON public.families FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "families_update_by_owner" ON public.families FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM family_members m
  WHERE ((m.family_id = families.id) AND (m.user_id = auth.uid()) AND (m.role = 'owner'::text)))));
CREATE POLICY "sel_families" ON public.families FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM family_members fm
  WHERE ((fm.family_id = families.id) AND (fm.user_id = auth.uid())))));
CREATE POLICY "families: members can select" ON public.families FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM family_members m
  WHERE ((m.family_id = families.id) AND (m.user_id = auth.uid())))));
CREATE POLICY "fm_select_self" ON public.family_members FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "groups: select if member" ON public.groups FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = groups.id) AND (gm.user_id = auth.uid())))));
CREATE POLICY "groups: insert owner only via function" ON public.groups FOR INSERT TO authenticated WITH CHECK ((owner_user_id = auth.uid()));
CREATE POLICY "groups: owner may update" ON public.groups FOR UPDATE TO authenticated USING ((owner_user_id = auth.uid())) WITH CHECK ((owner_user_id = auth.uid()));
CREATE POLICY "group_members: owner/admin can insert" ON public.group_members FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = group_members.group_id) AND (gm.user_id = auth.uid()) AND (gm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
CREATE POLICY "group_members: owner/admin can update roles" ON public.group_members FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = group_members.group_id) AND (gm.user_id = auth.uid()) AND (gm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = group_members.group_id) AND (gm.user_id = auth.uid()) AND (gm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
CREATE POLICY "group_members: owner/admin can delete; user can leave" ON public.group_members FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = group_members.group_id) AND (gm.user_id = auth.uid()) AND (gm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "group_members readable" ON public.group_members FOR SELECT TO authenticated USING (is_user_in_group(group_id, auth.uid()));
CREATE POLICY "Owners can update their lists" ON public.lists FOR UPDATE TO public USING ((owner_user_id = auth.uid())) WITH CHECK ((owner_user_id = auth.uid()));
CREATE POLICY "Owners can delete their lists" ON public.lists FOR DELETE TO public USING ((owner_user_id = auth.uid()));
CREATE POLICY "Users can view items from accessible lists" ON public.items FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM v_user_accessible_lists
  WHERE (v_user_accessible_lists.id = items.list_id))));
CREATE POLICY "Owners can share lists to groups" ON public.list_shares FOR INSERT TO public WITH CHECK ((auth.uid() = ( SELECT lists.owner_user_id
   FROM lists
  WHERE (lists.id = list_shares.list_id))));
CREATE POLICY "Owners can unshare lists from groups" ON public.list_shares FOR DELETE TO public USING ((auth.uid() = ( SELECT lists.owner_user_id
   FROM lists
  WHERE (lists.id = list_shares.list_id))));
CREATE POLICY "Users can create their own lists" ON public.lists FOR INSERT TO public WITH CHECK ((owner_user_id = auth.uid()));
CREATE POLICY "Group members can see shares" ON public.list_shares FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = list_shares.group_id) AND (gm.user_id = auth.uid())))));
CREATE POLICY "Users can view owned or group lists" ON public.lists FOR SELECT TO public USING (((owner_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.user_id = auth.uid()) AND (gm.group_id = ( SELECT gm2.group_id
           FROM group_members gm2
          WHERE (gm2.user_id = lists.owner_user_id)
         LIMIT 1)))))));
CREATE POLICY "Users can update items from accessible lists" ON public.items FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM v_user_accessible_lists
  WHERE (v_user_accessible_lists.id = items.list_id)))) WITH CHECK ((EXISTS ( SELECT 1
   FROM v_user_accessible_lists
  WHERE (v_user_accessible_lists.id = items.list_id))));
CREATE POLICY "Users can join existing groups" ON public.group_members FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION moddatetime();
CREATE TRIGGER trg_lists_owner_user_id BEFORE INSERT OR UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION set_lists_owner_user_id();
CREATE TRIGGER trg_profiles_family AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION on_profiles_insert_create_family();
CREATE TRIGGER trg_lists_defaults BEFORE INSERT ON public.lists FOR EACH ROW EXECUTE FUNCTION set_list_defaults();
CREATE TRIGGER items_set_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
