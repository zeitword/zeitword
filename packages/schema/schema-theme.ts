import type { fieldTypeEnum } from "./drizzle/schema"

type DFieldType = (typeof fieldTypeEnum.enumValues)[number]

type DField = {
  displayName: string
  type: DFieldType
  required?: boolean
  description?: string
  options?: { key: string; value: string }[]
  componentWhitelist?: string[]
  default?: string | number
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

const headingField: DField = { displayName: "Heading", type: "text" }
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
  target: {
    displayName: "Target",
    type: "option",
    options: [
      { key: "_self", value: "Same Tab" },
      { key: "_blank", value: "New Tab" }
    ],
    default: "_self"
  },
  icon: iconField
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

const footerFields: { [key: string]: DField } = {
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
  legal: {
    displayName: "Legal Links",
    type: "blocks",
    componentWhitelist: ["d-text-link"]
  },
  company: {
    displayName: "Company Name",
    type: "text"
  },
  copyright: {
    displayName: "Copyright",
    type: "text"
  },
  disclaimer: {
    displayName: "Disclaimer",
    type: "text"
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
    previewField: "text",
    fields: textLinkFields
  },
  "d-map-marker": {
    name: "d-map-marker",
    displayName: "Map Marker",
    previewField: "top",
    fields: {
      top: {
        displayName: "Top",
        type: "number"
      },
      left: {
        displayName: "Left",
        type: "number"
      }
    }
  },
  "d-map-marker-img": {
    name: "d-map-marker-img",
    displayName: "Map Marker Image",
    previewField: "top",
    fields: {
      image: {
        displayName: "Image",
        type: "asset"
      },
      top: {
        displayName: "Top",
        type: "number"
      },
      left: {
        displayName: "Left",
        type: "number"
      }
    }
  },
  "d-icon-link": {
    name: "d-icon-link",
    displayName: "Icon Link",
    previewField: "text",
    fields: {
      icon: iconField,
      text: { displayName: "Text", type: "text" },
      link: linkField
    }
  },
  "d-tag": {
    name: "d-tag",
    displayName: "Tag",
    previewField: "text",
    fields: {
      text: { displayName: "Text", type: "text" }
    }
  },
  "d-contact": {
    name: "d-contact",
    displayName: "Contact",
    previewField: "name",
    fields: {
      name: { displayName: "Name", type: "text" },
      image: imageField,
      roleLabel: {
        displayName: "Role Label",
        type: "text",
        description: "Displayed above the Role"
      },
      role: { displayName: "Role", type: "text" },
      description: descriptionField,
      location: { displayName: "Location", type: "text" },
      tags: {
        displayName: "Tags",
        type: "blocks",
        componentWhitelist: ["d-tag"]
      },
      links: {
        displayName: "Links",
        type: "blocks",
        componentWhitelist: ["d-icon-link"]
      }
    }
  },
  "block-cards-1": {
    name: "block-cards-1",
    displayName: "Cards Block 1",
    fields: {
      cards: {
        displayName: "Cards",
        type: "blocks",
        componentWhitelist: ["d-card"]
      }
    }
  },
  "block-logos-1": {
    name: "block-logos-1",
    displayName: "Logos Block 1",
    previewField: "title",
    fields: {
      heading: headingField,
      logos: {
        displayName: "Logos",
        type: "assets"
      }
    }
  },
  "block-intro-1": {
    name: "block-intro-1",
    displayName: "Intro Block 1",
    previewField: "title",
    fields: {
      heading: headingField,
      title: titleField,
      description: {
        displayName: "Description",
        type: "richtext"
      },
      buttons: {
        displayName: "Buttons",
        type: "blocks",
        componentWhitelist: ["d-button"]
      }
    }
  },
  "block-cta-1": {
    name: "block-cta-1",
    displayName: "CTA Block 1",
    previewField: "title",
    fields: {
      heading: headingField,
      title: titleField,
      description: descriptionField,
      buttons: {
        displayName: "Buttons",
        type: "blocks",
        componentWhitelist: ["d-button"]
      }
    }
  },
  "block-hero-1": {
    name: "block-hero-1",
    displayName: "Hero Block 1",
    previewField: "title",
    fields: {
      image: imageField,
      heading: headingField,
      title: titleField,
      description: descriptionField,
      buttons: {
        displayName: "Buttons",
        type: "blocks",
        componentWhitelist: ["d-button"]
      },
      center: {
        displayName: "Center",
        type: "boolean"
      }
    }
  },
  "block-navigation-1": {
    name: "block-navigation-1",
    displayName: "Navigation Block 1",
    fields: {
      slug: {
        displayName: "Slug",
        type: "text"
      }
    }
  },
  "block-map-1": {
    name: "block-map-1",
    displayName: "Map Block 1",
    previewField: "title",
    fields: {
      title: titleField,
      description: descriptionField,
      map: {
        displayName: "Map",
        type: "blocks",
        componentWhitelist: ["d-map-marker", "d-map-marker-img"]
      }
    }
  },
  "block-team-1": {
    name: "block-team-1",
    displayName: "Team Block 1",
    fields: {
      contacts: {
        displayName: "Contacts",
        type: "blocks",
        componentWhitelist: ["d-contact"]
      }
    }
  },
  "block-rich-text-1": {
    name: "block-rich-text-1",
    displayName: "Rich Text Block 1",
    fields: {
      body: {
        displayName: "Body",
        type: "richtext"
      }
    }
  },
  "block-articles-1": {
    name: "block-articles-1",
    displayName: "Articles Block 1",
    fields: {
      slug: {
        displayName: "Slug",
        type: "text"
      }
    }
  },
  footer: {
    name: "footer",
    displayName: "Footer",
    fields: footerFields
  },
  navigation: {
    name: "navigation",
    displayName: "Navigation",
    previewField: "title",
    fields: navigationFields
  },
  article: {
    name: "article",
    displayName: "Article",
    fields: {
      title: titleField,
      image: imageField,
      description: {
        displayName: "Description",
        type: "textarea"
      },
      date: {
        displayName: "Date",
        type: "datetime"
      },
      blocks: {
        displayName: "Blocks",
        type: "blocks",
        componentWhitelist: ["block-hero-1", "block-cards-1", "block-cta-1", "block-rich-text-1"]
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
        componentWhitelist: [
          "block-cards-1",
          "block-hero-1",
          "block-intro-1",
          "block-logos-1",
          "block-cta-1",
          "block-map-1",
          "block-team-1",
          "block-rich-text-1",
          "block-articles-1"
        ]
      }
    }
  }
}
