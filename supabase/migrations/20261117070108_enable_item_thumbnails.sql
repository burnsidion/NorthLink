BEGIN;
-- Reuse the existing optional column; validate existing values without deleting data.
ALTER TABLE public.items ADD CONSTRAINT items_image_url_https CHECK (
 image_url IS NULL OR (length(image_url) <= 2048 AND image_url ~ '^https://[^/@[:space:]]+\.[^/@[:space:]]+(/[^[:space:]]*)?$')
);
REVOKE INSERT(image_url), UPDATE(image_url) ON public.items FROM PUBLIC, anon;
GRANT INSERT(image_url), UPDATE(image_url) ON public.items TO authenticated;
-- Owner-only writes continue to be enforced by the existing items RLS policies.
CREATE OR REPLACE FUNCTION northlink_private.get_my_purchases()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=caller) THEN
    RAISE EXCEPTION 'Sign in to view your purchases.' USING ERRCODE='42501';
  END IF;
  RETURN (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',i.id,'title',i.title,'price_cents',i.price_cents,
      'image_url',i.image_url,'link',i.link,'notes',i.notes,'most_wanted',i.most_wanted,
      'list_title',l.title,'list_owner_name',COALESCE(p.display_name,'List owner')
    ) ORDER BY i.purchased_at DESC,i.id),'[]'::jsonb)
    FROM northlink_private.item_buyers b
    JOIN public.items i ON i.id=b.item_id
    JOIN public.lists l ON l.id=i.list_id
    LEFT JOIN public.profiles p ON p.id=l.owner_user_id
    WHERE b.buyer_user_id=caller AND i.purchased
    AND (l.owner_user_id=caller OR EXISTS(
      SELECT 1 FROM public.list_shares ls
      JOIN public.group_members gm ON gm.group_id=ls.group_id
      WHERE ls.list_id=l.id AND gm.user_id=caller
    ))
  );
END;
$$;
REVOKE ALL ON FUNCTION northlink_private.get_my_purchases() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION northlink_private.get_my_purchases() TO authenticated;

COMMIT;
