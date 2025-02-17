const schema = {
  page: {
    displayName: "Page",
    fields: {
      title: { type: "text", required: true },
      blocks: { type: "blocks", options: ["header1", "section1"] }
    }
  },
  header1: {
    displayName: "Header1",
    fields: {
      title: { type: "text", required: true },
      subtitle: { type: "text" }
    }
  },
  section1: {
    displayName: "Section1",
    fields: {
      title: { type: "text", required: true },
      content: { type: "richtext", required: true }
    }
  }
}

// const { data, error } = await useStory("/about-us")
// const { data, error } = await useStories("/about-us")
