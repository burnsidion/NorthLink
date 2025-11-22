-- Fix infinite recursion in list_shares RLS policies
-- Drop all existing policies on list_shares
DROP POLICY IF EXISTS "Owners can share lists to groups" ON list_shares;
DROP POLICY IF EXISTS "Owners can unshare lists from groups" ON list_shares;
DROP POLICY IF EXISTS "Owners and group members can see shares" ON list_shares;
DROP POLICY IF EXISTS "Users can view shared lists" ON list_shares;
DROP POLICY IF EXISTS "Users can manage list shares" ON list_shares;
DROP POLICY IF EXISTS "Enable read access for all users" ON list_shares;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON list_shares;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON list_shares;

-- Create new non-recursive policies that only reference base tables

-- Policy 1: Owners can share their lists to groups (INSERT)
CREATE POLICY "Owners can share lists to groups"
ON list_shares
FOR INSERT
WITH CHECK (
  auth.uid() = (
    SELECT owner_user_id
    FROM lists
    WHERE lists.id = list_shares.list_id
  )
);

-- Policy 2: Owners can unshare their lists from groups (DELETE)
CREATE POLICY "Owners can unshare lists from groups"
ON list_shares
FOR DELETE
USING (
  auth.uid() = (
    SELECT owner_user_id
    FROM lists
    WHERE lists.id = list_shares.list_id
  )
);

-- Policy 3: Group members can view shares (SELECT)
CREATE POLICY "Group members can see shares"
ON list_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = list_shares.group_id
      AND gm.user_id = auth.uid()
  )
);

-- Items RLS: allow users from accessible lists to view/update items

DROP POLICY IF EXISTS "Users can view items from accessible lists"
ON public.items;

DROP POLICY IF EXISTS "Users can update items from accessible lists"
ON public.items;

CREATE POLICY "Users can view items from accessible lists"
ON public.items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM v_user_accessible_lists
    WHERE v_user_accessible_lists.id = items.list_id
  )
);

CREATE POLICY "Users can update items from accessible lists"
ON public.items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM v_user_accessible_lists
    WHERE v_user_accessible_lists.id = items.list_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM v_user_accessible_lists
    WHERE v_user_accessible_lists.id = items.list_id
  )
);

-- Clean up redundant items RLS policies
DROP POLICY IF EXISTS "items_by_list_owner_delete" ON public.items;
DROP POLICY IF EXISTS "items_by_list_owner_insert" ON public.items;
DROP POLICY IF EXISTS "items_by_list_owner_select" ON public.items;
DROP POLICY IF EXISTS "items_by_list_owner_update" ON public.items;
DROP POLICY IF EXISTS "items_cud_through_list" ON public.items;
DROP POLICY IF EXISTS "items_select_through_list" ON public.items;

-- Add most_wanted and on_sale flags to items table
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS most_wanted boolean NOT NULL DEFAULT false;

ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS on_sale boolean NOT NULL DEFAULT false;
