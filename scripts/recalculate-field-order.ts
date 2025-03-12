import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { LexoRank } from "lexorank"
import { and, asc, eq } from "drizzle-orm"

async function recalculateFieldOrders() {
  const allComponents = await useDrizzle().select().from(tables.components)

  for (const component of allComponents) {
    // Get all fields for the current component, ordered by existing (incorrect) order
    const fields = await useDrizzle()
      .select()
      .from(tables.componentFields)
      .where(eq(tables.componentFields.componentId, component.id))
      .orderBy(asc(tables.componentFields.order))

    if (!fields.length) {
      continue
    }

    let prevRank: LexoRank | null = null
    for (const field of fields) {
      let newRank: LexoRank

      if (prevRank === null) {
        newRank = LexoRank.middle()
      } else {
        newRank = prevRank.genNext()
      }

      // Update the field with the new Lexorank
      try {
        await useDrizzle()
          .update(tables.componentFields)
          .set({ order: newRank.toString() })
          .where(
            and(
              eq(tables.componentFields.componentId, field.componentId),
              eq(tables.componentFields.fieldKey, field.fieldKey)
            )
          )
        console.log(
          `Updated field ${field.fieldKey} for component ${component.name} to order ${newRank.toString()}`
        )
      } catch (error) {
        console.error(
          `Error updating field ${field.fieldKey} for component ${component.name}:`,
          error
        )
        return
      }

      prevRank = newRank
    }
  }

  console.log("Field order recalculation complete.")
}

recalculateFieldOrders().catch((error) => {
  console.error("An error occurred during recalculation:", error)
})
