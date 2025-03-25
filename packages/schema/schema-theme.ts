import type { fieldTypeEnum } from "./drizzle/schema"

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
const linkField: DField = { displayName: "Link", type: "link" }
const iconField: DField = { displayName: "Icon", type: "text" }
const imageField: DField = { displayName: "Image", type: "asset" }

// --- Button Fields ---
const buttonFields: { [key: string]: DField } = {
  text: { displayName: "Text", type: "text" },
  link: linkField,
  variant: {
    displayName: "Variant",
    type: "option",
    options: [
      { key: "primary", value: "Primary" },
      { key: "secondary", value: "Secondary" },
      { key: "transparent", value: "Transparent" }
    ]
  },
  icon: iconField,
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

const imageLinkFields: { [key: string]: DField } = {
  image: imageField,
  link: linkField
}
const textLinkFields: { [key: string]: DField } = {
  text: { displayName: "Text", type: "text" },
  url: { displayName: "Url", type: "text" },
  target: {
    displayName: "Target",
    type: "option",
    options: [
      { key: "_blank", value: "Blank" },
      { key: "_self", value: "Self" },
      { key: "_parent", value: "Parent" },
      { key: "_top", value: "Top" }
    ]
  }
}

//Navigation fields
const navigationFields: { [key: string]: DField } = {
  logo: {
    displayName: "Logo",
    type: "blocks",
    componentWhitelist: ["d-image-link"]
  },
  links: {
    displayName: "Links",
    type: "blocks",
    componentWhitelist: ["d-text-link"]
  },
  buttons: {
    displayName: "Buttons",
    type: "blocks",
    componentWhitelist: ["d-button"]
  },
  startInverted: {
    displayName: "Start Inverted",
    type: "boolean"
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
  "d-image-link": {
    name: "d-image-link",
    displayName: "Image Link",
    fields: imageLinkFields
  },
  "d-text-link": {
    name: "d-text-link",
    displayName: "Text Link",
    fields: textLinkFields
  },
  "block-cards-1": {
    name: "block-cards-1",
    displayName: "Cards Block 1",
    previewField: "cards.0.title",
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
  "block-navigation-1": {
    name: "block-navigation-1",
    displayName: "Navigation Block 1",
    previewField: "logo",
    fields: navigationFields
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
        componentWhitelist: ["block-cards-1", "block-hero-1", "block-navigation-1"]
      }
    }
  }
}
