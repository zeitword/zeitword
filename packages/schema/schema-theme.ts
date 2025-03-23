import type { fieldTypeEnum } from "./drizzle/schema" // Assuming you have this from your Drizzle setup

type DFieldType = (typeof fieldTypeEnum.enumValues)[number]

type DField = {
  displayName: string
  type: DFieldType
  required?: boolean
  description?: string
  options?: { key: string; value: string }[]
  componentWhitelist?: string[]
}

type DComponent = {
  name: string
  displayName: string
  previewField?: string
  fields: {
    [key: string]: DField
  }
}

type DSchema = {
  [key: string]: DComponent
}

// --- Reusable Fields ---

const titleField: DField = { displayName: "Title", type: "text" }
const descriptionField: DField = { displayName: "Description", type: "textarea" }
const linkField: DField = { displayName: "Link", type: "link" } // Assuming 'link' type exists
const iconField: DField = { displayName: "Icon", type: "text" } // Assuming icon name (string) is sufficient

// --- Button Fields ---

const buttonFields: { [key: string]: DField } = {
  text: { displayName: "Text", type: "text" },
  link: linkField, // Use the reusable link field
  variant: {
    displayName: "Variant",
    type: "option",
    options: [
      { key: "primary", value: "Primary" },
      { key: "secondary", value: "Secondary" },
      { key: "transparent", value: "Transparent" }
    ]
  },
  icon: iconField, // Reusable icon field.
  size: {
    displayName: "Size",
    type: "option",
    options: [
      { key: "xs", value: "Extra Small" },
      { key: "sm", value: "Small" },
      { key: "md", value: "Medium" },
      { key: "lg", value: "Large" }
    ]
  }
}

// --- Card Fields ---

const cardFields: { [key: string]: DField } = {
  icon: iconField,
  title: titleField,
  description: descriptionField,
  buttons: {
    displayName: "Buttons",
    type: "blocks",
    componentWhitelist: ["d-button"]
  }
}

// --- Schema Definition ---

export const schema: DSchema = {
  "d-button": {
    name: "d-button",
    displayName: "Button",
    previewField: "text",
    fields: buttonFields
  },
  "d-card": {
    name: "d-card",
    displayName: "Card",
    previewField: "title",
    fields: cardFields
  },
  "block-cards-1": {
    name: "block-cards-1",
    displayName: "Cards Block 1",
    previewField: "cards.0.title", // Preview with the title of the first card.
    fields: {
      cards: {
        displayName: "Cards",
        type: "blocks",
        componentWhitelist: ["d-card"]
      }
    }
  },
  "block-hero-1": {
    name: "block-hero-1",
    displayName: "Hero Block 1",
    previewField: "title",
    fields: {
      title: titleField,
      description: descriptionField,
      buttons: {
        displayName: "Buttons",
        type: "blocks",
        componentWhitelist: ["d-button"]
      }
    }
  },
  page: {
    name: "page",
    displayName: "Page",
    previewField: "title",
    fields: {
      title: titleField,
      blocks: {
        displayName: "Blocks",
        type: "blocks",
        componentWhitelist: ["block-cards-1", "block-hero-1"]
      }
    }
  }
}
