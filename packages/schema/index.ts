import { useDrizzle } from "./drizzle/client";
import { componentFields, components, fieldOptions } from "./drizzle/schema";
import { schema } from "./schema";

const siteId = "0195857b-4aed-74be-9c4e-9289badd8ea3";
const organisationId = "01952950-33bd-7769-97ef-95d4e3fd9155";

for (const schemaKey in schema) {
  const component = schema[schemaKey];
  console.log(component);

  const [_component] = await useDrizzle()
    .insert(components)
    .values({
      name: component.name,
      displayName: component.displayName,
      previewField: component.previewField ?? null,
      siteId,
      organisationId,
    })
    .onConflictDoUpdate({
      target: [components.siteId, components.name],
      set: {
        displayName: component.displayName,
        previewField: component.previewField ?? null,
      },
    })
    .returning({
      id: components.id,
    });

  for (const fieldKey in component.fields) {
    const field = component.fields[fieldKey];

    await useDrizzle()
      .insert(componentFields)
      .values({
        fieldKey,
        componentId: _component.id,
        type: field.type,
        required: field.required ?? false,
        description: field.description ?? null,
        displayName: field.displayName ?? null,
        componentWhitelist: field.componentWhitelist ?? [],
        siteId,
        organisationId,
      })
      .onConflictDoUpdate({
        target: [componentFields.fieldKey, componentFields.componentId],
        set: {
          type: field.type,
          required: field.required ?? false,
          description: field.description ?? null,
          displayName: field.displayName ?? null,
          componentWhitelist: field.componentWhitelist ?? [],
        },
      });

    if (field.type === "option" && field.options) {
      for (const option of field.options) {
        await useDrizzle()
          .insert(fieldOptions)
          .values({
            componentId: _component.id,
            fieldKey,
            optionName: option.value,
            optionValue: option.key,
            siteId,
            organisationId,
          })
          .onConflictDoUpdate({
            target: [
              fieldOptions.componentId,
              fieldOptions.fieldKey,
              fieldOptions.optionValue,
            ],
            set: {
              optionName: option.value,
              optionValue: option.key,
            },
          });
      }
    }
  }

  const keys = Object.keys(component.fields);
  // TODO: delete fields that are no longer in the schema
}

process.exit(0);
