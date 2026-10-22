import tailwindcss from "@tailwindcss/vite"

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "latest",
  future: { compatibilityVersion: 5 },
  // Required by our server handlers under Nuxt 5 defaults.
  experimental: { nitroAutoImports: true },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["@lucide/vue", "reka-ui", "uuidv7"]
    }
  },
  ssr: false,

  devtools: { enabled: false },

  css: ["@/app.css"],
  modules: ["@vueuse/nuxt", "@nuxt/fonts", "@nuxt/image"],

  fonts: { processCSSVariables: true },

  runtimeConfig: {
    authSecret: "",
    authTrustedProxyIps: "",
    s3: {
      accessKeyId: "",
      secretAccessKey: "",
      endpoint: "",
      bucket: "",
      region: ""
    },

    //Resend
    resend: "",

    // OpenAI
    openaiApiKey: "",

    public: {
      siteUrl: "",
      appUrl: "https://app.zeitword.com"
    }
  },

  nitro: {
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
