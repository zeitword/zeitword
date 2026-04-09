import tailwindcss from "@tailwindcss/vite"

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "latest",
  future: { compatibilityVersion: 5 },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["lucide-vue-next", "reka-ui", "uuidv7"]
    }
  },
  ssr: false,

  devtools: { enabled: false },

  css: ["@/app.css"],
  modules: ["@vueuse/nuxt", "nuxt-auth-utils", "@nuxt/fonts", "@nuxt/image"],

  fonts: { experimental: { processCSSVariables: true } },

  runtimeConfig: {
    s3: {
      accessKeyId: "",
      secretAccessKey: "",
      endpoint: "",
      bucket: "",
      region: ""
    },

    //Resend
    resend: "",

    public: {
      siteUrl: "",
      appUrl: "https://app.zeitword.com"
    }
  },

  nitro: {
    // preset: "bun",
    // experimental: {
    //   openAPI: true
    // },
    storage: { limiter: { driver: "memory" } }
  },

  app: {
    head: {
      title: "Zeitword",
      link: [
        {
          rel: "icon",
          type: "image/x-icon",
          href: "/favicon.png",
          media: "(prefers-color-scheme: dark)"
        },
        {
          rel: "icon",
          type: "image/x-icon",
          href: "/favicon-light.png",
          media: "(prefers-color-scheme: light)"
        }
      ]
    }
  },

  image: {
    screens: {
      small: 80,
      medium: 500
    }
  }
})
