\set ON_ERROR_STOP on
CREATE EXTENSION pg_graphql;
-- Enable introspection only in this disposable fixture to audit reflected fields.
COMMENT ON SCHEMA public IS '@graphql({"introspection": true})';
GRANT USAGE ON SCHEMA graphql TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql TO anon,authenticated;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ DECLARE reflection jsonb; result jsonb; BEGIN
  reflection := graphql.resolve(query := '{ __schema { types { name fields { name } } } }');
  IF reflection ? 'errors' THEN RAISE EXCEPTION 'GraphQL introspection failed: %',reflection; END IF;
  IF lower(reflection::text) LIKE '%purchased_by%' OR lower(reflection::text) LIKE '%purchasedby%'
    OR lower(reflection::text) LIKE '%buyer_user_id%' OR lower(reflection::text) LIKE '%item_buyers%'
    OR lower(reflection::text) LIKE '%itembuyers%' THEN
    RAISE EXCEPTION 'Buyer field/table reflected in client GraphQL schema';
  END IF;
  result := graphql.resolve(query := '{ itemsCollection { edges { node { id purchased } } } }');
  IF result ? 'errors' OR result->'data'->'itemsCollection' IS NULL THEN
    RAISE EXCEPTION 'Expected ordinary item GraphQL reads to work: %',result;
  END IF;
  result := graphql.resolve(query := '{ itemsCollection { edges { node { purchased_by } } } }');
  IF NOT result ? 'errors' THEN RAISE EXCEPTION 'GraphQL buyer read was not rejected'; END IF;
END $$;
ROLLBACK;
\echo GraphQL buyer privacy checks passed
