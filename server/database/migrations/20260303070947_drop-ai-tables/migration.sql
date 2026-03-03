ALTER TABLE "language_model_usages" DROP CONSTRAINT "language_model_usages_user_id_users_id_fk";
ALTER TABLE "language_model_usages" DROP CONSTRAINT "language_model_usages_organisation_id_organisations_id_fk";
ALTER TABLE "language_model_usage_credits" DROP CONSTRAINT "language_model_usage_credits_organisation_id_organisations_id_fk";
DROP TABLE "language_model_usages";
DROP TABLE "language_model_usage_credits";
