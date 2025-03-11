import type { fieldTypeEnum } from "./drizzle/schema";

type DFieldType = (typeof fieldTypeEnum.enumValues)[number];
type DField = {
  displayName: string;
  type: DFieldType;
  required?: boolean;
  description?: string;
  options?: { key: string; value: string }[];
  componentWhitelist?: string[];
};
type DComponent = {
  name: string;
  displayName: string;
  previewField?: string;
  fields: {
    [key: string]: DField;
  };
};

type DSchema = {
  [key: string]: DComponent;
};

const colorField: DField = {
  displayName: "Color",
  type: "option",
  options: [
    { key: "slate", value: "Slate" },
    { key: "gray", value: "Gray" },
    { key: "zinc", value: "Zinc" },
    { key: "neutral", value: "Neutral" },
    { key: "stone", value: "Stone" },
    { key: "red", value: "Red" },
    { key: "orange", value: "Orange" },
    { key: "amber", value: "Amber" },
    { key: "yellow", value: "Yellow" },
    { key: "lime", value: "Lime" },
    { key: "green", value: "Green" },
    { key: "emerald", value: "Emerald" },
    { key: "teal", value: "Teal" },
    { key: "cyan", value: "Cyan" },
    { key: "sky", value: "Sky" },
    { key: "blue", value: "Blue" },
    { key: "indigo", value: "Indigo" },
    { key: "violet", value: "Violet" },
    { key: "purple", value: "Purple" },
    { key: "fuchsia", value: "Fuchsia" },
    { key: "pink", value: "Pink" },
    { key: "rose", value: "Rose" },
  ],
};

const organisationField: DField = {
  displayName: "Organisation",
  type: "option",
  options: [
    { key: "Gesamtschule", value: "Gesamtschule" },
    { key: "Grundschule", value: "Grundschule" },
    { key: "Kita", value: "Kita" },
    { key: "Geschäftsführung", value: "Geschäftsführung" },
    { key: "Verwaltung", value: "Verwaltung" },
    { key: "Hausmeisterei", value: "Hausmeisterei" },
    { key: "Küche", value: "Küche" },
    { key: "Reinigung", value: "Reinigung" },
  ],
};

const departmentField: DField = {
  displayName: "Department",
  type: "option",
  options: [
    { key: "Schulleitungsteam", value: "Schulleitungsteam" },
    { key: "Pädagogisches Team", value: "Pädagogisches Team" },
    { key: "Verwaltungsteam", value: "Verwaltungsteam" },
    { key: "Leitung", value: "Leitung" },
    { key: "Organisation", value: "Organisation" },
  ],
};

const contentFields: { [key: string]: DField } = {
  headline: {
    displayName: "Headline",
    type: "text",
  },
  color: colorField,
  title: {
    displayName: "Title",
    type: "text",
  },
  subtitle: {
    displayName: "Subtitle",
    type: "text",
  },
  description: {
    displayName: "Description",
    type: "textarea",
  },
  buttons: {
    displayName: "Buttons",
    type: "blocks",
    componentWhitelist: ["button"],
  },
};

export const schema: DSchema = {
  page: {
    name: "page",
    displayName: "Page",
    fields: {
      title: { displayName: "Title", type: "text" },
      blocks: {
        displayName: "Blocks",
        type: "blocks",
        componentWhitelist: [
          "section-cards",
          "section-gallery",
          "section-general",
          "section-hero",
          "section-image",
          "section-intro",
          "section-join",
          "section-posts",
          "section-streetview",
          "section-team-grid",
          "section-team",
          "section-video",
        ],
      },
    },
  },
  button: {
    name: "button",
    displayName: "Button",
    previewField: "link",
    fields: {
      text: { displayName: "Text", type: "text" },
      link: { displayName: "Link", type: "link" },
      variant: {
        displayName: "Variant",
        type: "option",
        options: [
          { key: "primary", value: "Primary" },
          { key: "secondary", value: "Secondary" },
          { key: "link", value: "Link" },
        ],
      },
    },
  },
  card: {
    name: "card",
    displayName: "Card",
    previewField: "title",
    fields: contentFields,
  },
  team_member: {
    name: "team-member",
    displayName: "Team Member",
    previewField: "first_name",
    fields: {
      first_name: { displayName: "First Name", type: "text" },
      last_name: { displayName: "Last Name", type: "text" },
      position: { displayName: "Position", type: "text" },
      image: { displayName: "Image", type: "asset" },
      organisation: organisationField,
      department: departmentField,
    },
  },
  section_cards: {
    name: "section-cards",
    displayName: "Section Cards",
    previewField: "title",
    fields: {
      ...contentFields,
      cards: {
        displayName: "Cards",
        type: "blocks",
        componentWhitelist: ["card"],
      },
    },
  },
  section_gallery: {
    name: "section-gallery",
    displayName: "Section Gallery",
    fields: {
      images: { displayName: "Images", type: "assets" },
    },
  },
  section_general: {
    name: "section-general",
    displayName: "Section General",
    fields: {
      ...contentFields,
      image: { displayName: "Image", type: "asset" },
    },
  },
  section_hero: {
    name: "section-hero",
    displayName: "Section Hero",
    previewField: "title",
    fields: {
      color: colorField,
      title: { displayName: "Title", type: "text" },
      buttons: {
        displayName: "Buttons",
        type: "blocks",
        componentWhitelist: ["button"],
      },
      image: { displayName: "Image", type: "asset" },
    },
  },
  section_image: {
    name: "section-image",
    displayName: "Section Image",
    fields: {
      image: { displayName: "Image", type: "asset" },
    },
  },
  section_intro: {
    name: "section-intro",
    displayName: "Section Intro",
    fields: contentFields,
  },
  section_join: {
    name: "section-join",
    displayName: "Section Join",
    fields: {},
  },
  section_posts: {
    name: "section-posts",
    displayName: "Section Posts",
    fields: {},
  },
  section_streetview: {
    name: "section-streetview",
    displayName: "Section Streetview",
    fields: {
      url: { displayName: "URL", type: "link" },
    },
  },
  section_team_grid: {
    name: "section-team-grid",
    displayName: "Section Team Grid",
    previewField: "title",
    fields: {
      ...contentFields,
      organisation: organisationField,
      department: departmentField,
    },
  },
  section_team: {
    name: "section-team",
    displayName: "Section Team",
    fields: {
      organisation: organisationField,
      department: departmentField,
    },
  },
  section_video: {
    name: "section-video",
    displayName: "Section Video",
    fields: {
      video: { displayName: "Video", type: "asset" },
    },
  },
};
