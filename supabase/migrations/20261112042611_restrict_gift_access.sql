-- OWL-55: limit gifts and list metadata to owners and explicitly shared members.
-- Preserve buyer/field-level behavior until OWL-58.
BEGIN;

DROP POLICY "Users can view owned or group lists" ON public.lists;
CREATE POLICY "Users can view owned or group lists"
ON public.lists FOR SELECT TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.v_user_accessible_lists accessible
    WHERE accessible.id = lists.id
      AND accessible.shared_user_id = (SELECT auth.uid())
  )
);

-- Both old and new rows must belong to a list the caller can read.
-- These queries deliberately use lists' RLS, not the metadata view.
ALTER POLICY "Users can view items from accessible lists" ON public.items
TO authenticated
USING (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = items.list_id));

ALTER POLICY "Users can update items from accessible lists" ON public.items
TO authenticated
USING (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = items.list_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = items.list_id));

-- This view intentionally retains owner privileges for owner name/avatar:
-- profiles only allows self-reads. Authorization is explicit inside the view.
-- The lists policy also checks shared_user_id explicitly. Keeping this view's
-- joins outside RLS avoids the lists -> shares -> lists cycle during unsharing.
CREATE OR REPLACE VIEW public.v_user_accessible_lists
WITH (security_barrier = true, security_invoker = false) AS
SELECT l.id, l.title, l.owner_user_id,
       p.display_name AS owner_display_name, l.created_at,
       gm.user_id AS shared_user_id, p.avatar_url AS owner_avatar_url
FROM public.lists l
LEFT JOIN public.profiles p ON p.id = l.owner_user_id
LEFT JOIN public.list_shares ls ON ls.list_id = l.id
LEFT JOIN public.group_members gm
  ON gm.group_id = ls.group_id AND gm.user_id = (SELECT auth.uid())
WHERE (SELECT auth.uid()) IS NOT NULL
  AND (l.owner_user_id = (SELECT auth.uid()) OR gm.user_id = (SELECT auth.uid()));

-- Aggregate only rows visible through lists/items policies.
ALTER VIEW public.list_progress SET (security_invoker = true, security_barrier = true);
REVOKE ALL ON public.v_user_accessible_lists, public.list_progress FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.v_user_accessible_lists, public.list_progress FROM authenticated;
GRANT SELECT ON public.v_user_accessible_lists, public.list_progress TO authenticated;

COMMIT;
