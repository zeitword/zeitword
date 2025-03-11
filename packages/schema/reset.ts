import { and, eq } from "drizzle-orm";
import { useDrizzle } from "./drizzle/client";
import { componentFields, components, fieldOptions } from "./drizzle/schema";

const siteId = "0195857b-4aed-74be-9c4e-9289badd8ea3";
const organisationId = "01952950-33bd-7769-97ef-95d4e3fd9155";

// fieldOptions

await useDrizzle()
  .delete(fieldOptions)
  .where(
    and(
      eq(fieldOptions.siteId, siteId),
      eq(fieldOptions.organisationId, organisationId)
    )
  );

// fields

await useDrizzle()
  .delete(componentFields)
  .where(
    and(
      eq(componentFields.siteId, siteId),
      eq(componentFields.organisationId, organisationId)
    )
  );

// components

await useDrizzle()
  .delete(components)
  .where(
    and(
      eq(components.siteId, siteId),
      eq(components.organisationId, organisationId)
    )
  );

process.exit(0);
