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
  fields: { [key: string]: DField }
}

type DSchema = { [key: string]: DComponent }

// ── Helpers ──────────────────────────────────────────────────────────

const t = (displayName: string): DField => ({ displayName, type: "text" })
const ta = (displayName: string): DField => ({ displayName, type: "textarea" })
const img = (displayName: string): DField => ({ displayName, type: "asset" })
const bool = (displayName: string): DField => ({ displayName, type: "boolean" })
const blocks = (displayName: string, whitelist: string[]): DField => ({
  displayName,
  type: "blocks",
  componentWhitelist: whitelist,
})

// ── Schema ───────────────────────────────────────────────────────────

export const schema: DSchema = {
  // ── Primitives (nestable sub-components) ─────────────────────────

  "d-button": {
    name: "d-button",
    displayName: "Button",
    previewField: "text",
    fields: {
      text: t("Text"),
      link: t("Link"),
      variant: {
        displayName: "Variant",
        type: "option",
        options: [
          { key: "primary", value: "Primary" },
          { key: "secondary", value: "Secondary" },
        ],
      },
    },
  },

  "d-card": {
    name: "d-card",
    displayName: "Card",
    previewField: "title",
    fields: {
      icon: t("Icon"),
      image: img("Image"),
      title: t("Title"),
      description: ta("Description"),
      link: t("Link"),
    },
  },

  "d-image-card": {
    name: "d-image-card",
    displayName: "Image Card",
    previewField: "title",
    fields: {
      heading: t("Heading"),
      title: t("Title"),
      description: ta("Description"),
      image: img("Image"),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
    },
  },

  "d-input": {
    name: "d-input",
    displayName: "Form Input",
    previewField: "label",
    fields: {
      name: t("Field Name"),
      label: t("Label"),
      type: t("Type"),
      placeholder: t("Placeholder"),
      required: bool("Required"),
    },
  },

  "d-textarea": {
    name: "d-textarea",
    displayName: "Form Textarea",
    previewField: "label",
    fields: {
      name: t("Field Name"),
      label: t("Label"),
      placeholder: t("Placeholder"),
      required: bool("Required"),
      rows: t("Rows"),
    },
  },

  "d-text-link": {
    name: "d-text-link",
    displayName: "Text Link",
    previewField: "text",
    fields: {
      text: t("Text"),
      url: t("URL"),
    },
  },

  "d-slide": {
    name: "d-slide",
    displayName: "Slide",
    previewField: "name",
    fields: {
      name: t("Tab Label"),
      image: img("Image"),
      title1: t("Title Line 1"),
      title2: t("Title Line 2"),
    },
  },

  "d-contact": {
    name: "d-contact",
    displayName: "Contact",
    previewField: "name",
    fields: {
      name: t("Name"),
      roleLabel: t("Role Label"),
      role: t("Role"),
      description: ta("Description"),
      image: img("Image"),
      location: t("Location"),
    },
  },

  "d-map-marker": {
    name: "d-map-marker",
    displayName: "Map Marker",
    previewField: "name",
    fields: {
      name: t("Name"),
      posTop: t("Position Top (%)"),
      posLeft: t("Position Left (%)"),
    },
  },

  // ── Block Components ─────────────────────────────────────────────

  "header-1": {
    name: "header-1",
    displayName: "Hero Simple",
    previewField: "title",
    fields: {
      id: t("Anchor ID"),
      title: t("Title"),
      description: ta("Description"),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
    },
  },

  "team-1": {
    name: "team-1",
    displayName: "Team Grid",
    fields: {
      id: t("Anchor ID"),
      contacts: blocks("Contacts", ["d-contact"]),
    },
  },

  "form-1": {
    name: "form-1",
    displayName: "Contact Form",
    fields: {
      id: t("Anchor ID"),
      fields: blocks("Fields", ["d-input", "d-textarea"]),
      submitButtonText: t("Submit Button Text"),
      privacyText: ta("Privacy Text"),
      privacyLinkText: t("Privacy Link Text"),
      privacyLinkUrl: t("Privacy Link URL"),
    },
  },

  "html-1": {
    name: "html-1",
    displayName: "HTML Block",
    fields: {
      id: t("Anchor ID"),
      html: ta("HTML Content"),
    },
  },

  "navigation-1": {
    name: "navigation-1",
    displayName: "Navigation",
    fields: {
      logoImage: img("Logo Image"),
      logoLink: t("Logo Link"),
      links: blocks("Links", ["d-text-link"]),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
      startInverted: bool("Start Inverted"),
    },
  },

  "header-2": {
    name: "header-2",
    displayName: "Hero",
    previewField: "title",
    fields: {
      slides: blocks("Slides", ["d-slide"]),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
    },
  },

  "cards-1": {
    name: "cards-1",
    displayName: "Cards",
    previewField: "title",
    fields: {
      id: t("Anchor ID"),
      title: t("Title"),
      description: ta("Description"),
      center: bool("Centered"),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
      cards: blocks("Cards", ["d-card"]),
    },
  },

  "cards-2": {
    name: "cards-2",
    displayName: "Image Cards",
    fields: {
      id: t("Anchor ID"),
      cards: blocks("Cards", ["d-image-card"]),
    },
  },

  "intro-1": {
    name: "intro-1",
    displayName: "Intro",
    previewField: "title",
    fields: {
      id: t("Anchor ID"),
      heading: t("Heading"),
      title: t("Title"),
      description: ta("Description"),
      center: bool("Centered"),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
    },
  },

  "image-1": {
    name: "image-1",
    displayName: "CTA Image",
    previewField: "title",
    fields: {
      id: t("Anchor ID"),
      image: img("Image"),
      title: t("Title"),
      description: ta("Description"),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
    },
  },

  "image-2": {
    name: "image-2",
    displayName: "Before/After",
    previewField: "title",
    fields: {
      id: t("Anchor ID"),
      heading: t("Heading"),
      title: t("Title"),
      description: ta("Description"),
      before: img("Before Image"),
      after: img("After Image"),
    },
  },

  "image-3": {
    name: "image-3",
    displayName: "Framed Image",
    previewField: "title",
    fields: {
      id: t("Anchor ID"),
      image: img("Image"),
      title: t("Title"),
      description: ta("Description"),
      center: bool("Centered"),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
    },
  },

  "map-1": {
    name: "map-1",
    displayName: "Map",
    previewField: "title",
    fields: {
      id: t("Anchor ID"),
      heading: t("Heading"),
      title: t("Title"),
      description: ta("Description"),
      buttonText: t("Button Text"),
      buttonLink: t("Button Link"),
      mapImage: img("Map Image"),
      locations: blocks("Locations", ["d-map-marker"]),
    },
  },

  "footer-1": {
    name: "footer-1",
    displayName: "Footer",
    fields: {
      id: t("Anchor ID"),
      logoImage: img("Logo Image"),
      logoLink: t("Logo Link"),
      company: t("Company Name"),
      links: blocks("Links", ["d-text-link"]),
      legal: blocks("Legal Links", ["d-text-link"]),
    },
  },

  // ── Content Types ────────────────────────────────────────────────

  page: {
    name: "page",
    displayName: "Page",
    previewField: "title",
    fields: {
      title: t("Title"),
      blocks: blocks("Blocks", [
        "navigation-1",
        "header-1",
        "header-2",
        "cards-1",
        "cards-2",
        "intro-1",
        "image-1",
        "image-2",
        "image-3",
        "map-1",
        "team-1",
        "form-1",
        "html-1",
        "footer-1",
      ]),
    },
  },
}
