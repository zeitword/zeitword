ALTER TABLE IF EXISTS "language_model_usages" DROP CONSTRAINT IF EXISTS "language_model_usages_user_id_users_id_fk";
ALTER TABLE IF EXISTS "language_model_usages" DROP CONSTRAINT IF EXISTS "language_model_usages_organisation_id_organisations_id_fk";
ALTER TABLE IF EXISTS "language_model_usage_credits" DROP CONSTRAINT IF EXISTS "language_model_usage_credits_organisation_id_organisations_id_fk";
DROP TABLE IF EXISTS "language_model_usages";
DROP TABLE IF EXISTS "language_model_usage_credits";
