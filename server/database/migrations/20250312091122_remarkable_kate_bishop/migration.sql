-- migrations/0003_add_and_populate_order.sql

-- Add the 'order' column (initially without NOT NULL)
ALTER TABLE "component_fields" ADD COLUMN "order" text;

-- Populate the 'order' column for existing rows using a CTE and window function.
WITH RankedFields AS (
    SELECT
        component_id,
        field_key,
        site_id,
        ROW_NUMBER() OVER (PARTITION BY component_id, site_id ORDER BY field_key) as rn
    FROM "component_fields"
)
UPDATE "component_fields"
SET "order" = '0|' || LPAD(CAST(RankedFields.rn AS TEXT), 5, '0') || ':'
FROM RankedFields
WHERE "component_fields".component_id = RankedFields.component_id
  AND "component_fields".field_key = RankedFields.field_key
  AND "component_fields".site_id = RankedFields.site_id;

-- Add the NOT NULL constraint *after* populating the column.
ALTER TABLE "component_fields" ALTER COLUMN "order" SET NOT NULL;
