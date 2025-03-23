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

const linkField: DField = {
  displayName: "Link",
  type: "link"
}

const imageField: DField = {
  displayName: "Image",
  type: "asset"
}

const videoField: DField = {
  displayName: "Video",
  type: "asset"
}

const titleField: DField = { displayName: "Title", type: "text" }
const headingField: DField = { displayName: "Heading", type: "text" }
const descriptionField: DField = { displayName: "Description", type: "textarea" }

const iconField: DField = { displayName: "Icon", type: "text" } // Simplified, assuming icon name is stored as text.  Consider "custom" if you need a dedicated icon picker.

const buttonFields: { [key: string]: DField } = {
  text: { displayName: "Text", type: "text" },
  link: linkField,
  variant: {
    displayName: "Variant",
    type: "option",
    options: [
      { key: "primary", value: "Primary" },
      { key: "secondary", value: "Secondary" },
      { key: "transparent", value: "Transparent" },
      { key: "text", value: "Text" },
      { key: "accent", value: "Accent" }
    ]
  },
  inverse: { displayName: "Inverse", type: "boolean" }
}

const cardFields: { [key: string]: DField } = {
  variant: {
    displayName: "Variant",
    type: "option",
    options: [
      { key: "neutral", value: "Neutral" },
      { key: "white", value: "White" },
      { key: "accent", value: "Accent" }
    ]
  },
  icon: iconField,
  image: imageField,
  number: { displayName: "Number", type: "text" },
  heading: headingField,
  title: titleField,
  description: descriptionField,
  button: {
    displayName: "Button",
    type: "blocks",
    componentWhitelist: ["button"]
  },
  link: linkField,
  interactive: { displayName: "Interactive", type: "boolean" }
}

const introFields: { [key: string]: DField } = {
  heading: headingField,
  title: titleField,
  level: {
    displayName: "Heading Level",
    type: "option",
    options: [
      { key: "1", value: "H1" },
      { key: "2", value: "H2" },
      { key: "3", value: "H3" },
      { key: "4", value: "H4" },
      { key: "5", value: "H5" },
      { key: "6", value: "H6" }
    ]
  },
  width: {
    displayName: "Width",
    type: "option",
    options: [
      { key: "xs", value: "Extra Small" },
      { key: "sm", value: "Small" },
      { key: "md", value: "Medium" },
      { key: "lg", value: "Large" }
    ]
  },
  description: descriptionField,
  button: {
    displayName: "Button",
    type: "blocks",
    componentWhitelist: ["button"]
  },
  center: { displayName: "Centered", type: "boolean" },
  inverse: { displayName: "Inverse", type: "boolean" }
}

const backgroundField: DField = {
  displayName: "Background Color",
  type: "option",
  options: [
    { key: "white", value: "White" },
    { key: "neutral", value: "Neutral" },
    { key: "accent", value: "Accent" },
    { key: "transparent", value: "Transparent" }
  ]
}

const spacingField: DField = {
  displayName: "Spacing",
  type: "custom"
}

export const schema: DSchema = {
  "base-button": {
    name: "base-button",
    displayName: "Button",
    previewField: "text",
    fields: buttonFields
  },
  "base-card": {
    name: "base-card",
    displayName: "Card",
    previewField: "title",
    fields: cardFields
  },
  "base-teaser-card2": {
    name: "base-teaser-card2",
    displayName: "Teaser Card",
    previewField: "title",
    fields: cardFields
  },
  "base-intro": {
    name: "base-intro",
    displayName: "Intro",
    previewField: "title",
    fields: introFields
  },
  "base-image": {
    name: "base-image",
    displayName: "Image",
    fields: {
      image: imageField
    }
  },
  "base-video": {
    name: "base-video",
    displayName: "Video",
    fields: {
      video: videoField
    }
  },
  "base-heading": {
    name: "base-heading",
    displayName: "Heading",
    fields: {
      level: {
        displayName: "Heading Level",
        type: "option",
        options: [
          { key: "1", value: "H1" },
          { key: "2", value: "H2" },
          { key: "3", value: "H3" },
          { key: "4", value: "H4" },
          { key: "5", value: "H5" },
          { key: "6", value: "H6" }
        ]
      },
      inverse: { displayName: "Inverse", type: "boolean" },
      text: { displayName: "Text", type: "text" }
    }
  },
  "base-title": {
    name: "base-title",
    displayName: "Title",
    fields: {
      level: {
        displayName: "Heading Level",
        type: "option",
        options: [
          { key: "1", value: "H1" },
          { key: "2", value: "H2" },
          { key: "3", value: "H3" },
          { key: "4", value: "H4" },
          { key: "5", value: "H5" },
          { key: "6", value: "H6" }
        ]
      },
      inverse: { displayName: "Inverse", type: "boolean" },
      neutral: { displayName: "Neutral", type: "boolean" },
      text: { displayName: "Text", type: "text" }
    }
  },
  "base-text": {
    name: "base-text",
    displayName: "Text",
    fields: {
      text: { displayName: "Text", type: "text" },
      size: {
        displayName: "Size",
        type: "option",
        options: [
          { key: "2xl", value: "2xl" },
          { key: "xl", value: "xl" },
          { key: "lg", value: "lg" },
          { key: "md", value: "md" },
          { key: "sm", value: "sm" },
          { key: "xs", value: "xs" }
        ]
      },
      inverse: { displayName: "Inverse", type: "boolean" },
      variant: {
        displayName: "Variant",
        type: "option",
        options: [
          { key: "subtle", value: "Subtle" },
          { key: "strong", value: "Strong" }
        ]
      }
    }
  },
  "base-checkmark": {
    name: "base-checkmark",
    displayName: "Checkmark",
    fields: {
      text: { displayName: "Text", type: "text" },
      inverse: { displayName: "Inverse", type: "boolean" }
    }
  },
  "base-link": {
    name: "base-link",
    displayName: "Link",
    fields: {
      inverse: { displayName: "Inverse", type: "boolean" },
      ...linkField
    }
  },
  "base-boxed-icon": {
    name: "base-boxed-icon",
    displayName: "Boxed Icon",
    fields: {
      icon: iconField,
      text: { displayName: "Text", type: "text" },
      fg: { displayName: "Foreground Color", type: "text" },
      bg: { displayName: "Background Color", type: "text" }
    }
  },

  "block-cards1": {
    name: "block-cards1",
    displayName: "Cards Block",
    previewField: "intro.title",
    fields: {
      id: { displayName: "ID", type: "text" },
      background: backgroundField,
      intro: {
        displayName: "Intro",
        type: "blocks",
        componentWhitelist: ["base-intro"]
      },
      cards: {
        displayName: "Cards",
        type: "blocks",
        componentWhitelist: ["base-card"]
      },
      buttons: {
        displayName: "Buttons",
        type: "blocks",
        componentWhitelist: ["base-button"]
      }
    }
  },
  "block-cta1": {
    name: "block-cta1",
    displayName: "CTA Block",
    fields: {
      background: backgroundField,
      heading: headingField,
      title: titleField,
      description: descriptionField,
      benefits: {
        displayName: "Benefits",
        type: "textarea",
        description: "List of benefits (one per line)"
      },
      buttons: {
        displayName: "Buttons",
        type: "blocks",
        componentWhitelist: ["base-button"]
      }
    }
  },
  "block-footer1": {
    name: "block-footer1",
    displayName: "Footer Block",
    previewField: "company",
    fields: {
      id: { displayName: "ID", type: "text" },
      background: backgroundField,
      spacing: spacingField,

      links: {
        displayName: "Links",
        type: "blocks",
        componentWhitelist: ["text-link"]
      },
      legal: {
        displayName: "Legal Links",
        type: "blocks",
        componentWhitelist: ["text-link"]
      },
      logo: {
        displayName: "Logo",
        type: "blocks",
        componentWhitelist: ["image-link"]
      },
      company: { displayName: "Company Name", type: "text" },
      disclaimer: { displayName: "Disclaimer", type: "textarea" },
      badge: {
        displayName: "Badge",
        type: "blocks",
        componentWhitelist: ["badge"]
      }
    }
  },
  "block-hero1": {
    name: "block-hero1",
    displayName: "Hero Block",
    fields: {
      id: { displayName: "ID", type: "text" },
      background: backgroundField,
      video: {
        displayName: "Video",
        type: "blocks",
        componentWhitelist: ["base-video"]
      },
      image: {
        displayName: "Image",
        type: "blocks",
        componentWhitelist: ["base-image"]
      },
      heading: headingField,
      title: titleField,
      level: {
        displayName: "Level",
        type: "number"
      },
      description: descriptionField,
      width: {
        displayName: "Width",
        type: "text"
      },
      buttons: {
        displayName: "Buttons",
        type: "blocks",
        componentWhitelist: ["base-button"]
      },
      benefits: {
        displayName: "Benefits",
        type: "text"
      },
      center: { displayName: "Center Content", type: "boolean" }
    }
  },
  "block-html1": {
    name: "block-html1",
    displayName: "HTML Block",
    fields: {
      background: backgroundField,
      html: { displayName: "HTML", type: "richtext" }
    }
  },
  "block-image2": {
    name: "block-image2",
    displayName: "Image Block 2",
    fields: {
      id: { displayName: "ID", type: "text" },
      background: backgroundField,
      spacing: spacingField,
      intro: {
        displayName: "Intro",
        type: "blocks",
        componentWhitelist: ["base-intro"]
      },
      image: {
        displayName: "Image",
        type: "blocks",
        componentWhitelist: ["base-image"]
      }
    }
  },
  "block-image3": {
    name: "block-image3",
    displayName: "Image Block 3",
    fields: {
      background: backgroundField,
      intro: {
        displayName: "Intro",
        type: "blocks",
        componentWhitelist: ["base-intro"]
      },
      image: {
        displayName: "Image",
        type: "blocks",
        componentWhitelist: ["base-image"]
      }
    }
  },
  "block-intro1": {
    name: "block-intro1",
    displayName: "Intro Block",
    fields: {
      id: { displayName: "ID", type: "text" },
      background: backgroundField,
      spacing: spacingField,
      ...introFields
    }
  },
  "block-navigation1": {
    name: "block-navigation1",
    displayName: "Navigation Block",
    fields: {
      logo: {
        displayName: "Logo",
        type: "blocks",
        componentWhitelist: ["image-link"]
      },
      links: {
        displayName: "Links",
        type: "blocks",
        componentWhitelist: ["base-link"]
      },
      button: {
        displayName: "Button",
        type: "blocks",
        componentWhitelist: ["base-button"]
      },
      startInverted: { displayName: "Start Inverted", type: "boolean" }
    }
  },

  // Helper Components (Used within blocks)
  "text-link": {
    name: "text-link",
    displayName: "Text Link",
    fields: {
      text: { displayName: "Text", type: "text" },
      link: linkField
    }
  },
  "image-link": {
    name: "image-link",
    displayName: "Image Link",
    fields: {
      image: imageField,
      link: linkField
    }
  },
  badge: {
    name: "badge",
    displayName: "Badge",
    fields: {
      logo: imageField,
      text: { displayName: "Text", type: "text" },
      link: linkField
    }
  }
}
