export class ZeitwordApi {
  constructor(
    private apiUrl: string,
    private token: string
  ) {}

  private async request<T = any>(
    path: string,
    options: {
      method?: string
      body?: unknown
      params?: Record<string, string>
    } = {}
  ): Promise<T> {
    const url = new URL(path, this.apiUrl)
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value)
      }
    }

    const res = await fetch(url.toString(), {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      let message = `HTTP ${res.status}: ${res.statusText}`
      try {
        const json = JSON.parse(text)
        if (json.statusMessage) message = json.statusMessage
        if (json.message) message = json.message
      } catch {
        if (text) message = text
      }
      throw new Error(message)
    }

    return res.json() as Promise<T>
  }

  // Sites
  async listSites() {
    return this.request<any[]>("/api/sites")
  }

  async getSite(siteId: string) {
    return this.request(`/api/sites/${siteId}`)
  }

  async createSite(data: { name: string; domain?: string; defaultLanguage?: string }) {
    return this.request("/api/sites", { method: "POST", body: data })
  }

  async updateSite(siteId: string, data: { name?: string; domain?: string }) {
    return this.request(`/api/sites/${siteId}`, { method: "PUT", body: data })
  }

  async deleteSite(siteId: string) {
    return this.request(`/api/sites/${siteId}`, { method: "DELETE" })
  }

  // Stories
  async listStories(siteId: string, params?: { search?: string }) {
    return this.request(`/api/sites/${siteId}/stories`, { params: params as any })
  }

  async getStory(siteId: string, storyId: string) {
    return this.request(`/api/sites/${siteId}/stories/${storyId}`)
  }

  async getStoryChildren(siteId: string, storyId: string) {
    return this.request(`/api/sites/${siteId}/stories/${storyId}/children`)
  }

  async createStory(
    siteId: string,
    data: {
      slug: string
      title: string
      type?: "story" | "folder"
      content?: Record<string, any>
      componentId?: string
    }
  ) {
    return this.request(`/api/sites/${siteId}/stories`, { method: "POST", body: data })
  }

  async updateStory(
    siteId: string,
    storyId: string,
    data: {
      slug?: string
      title?: string
      content?: Record<string, any>
    }
  ) {
    return this.request(`/api/sites/${siteId}/stories/${storyId}`, {
      method: "PUT",
      body: data
    })
  }

  async deleteStory(siteId: string, storyId: string) {
    return this.request(`/api/sites/${siteId}/stories/${storyId}`, { method: "DELETE" })
  }

  // Components
  async listComponents(siteId: string) {
    return this.request<any[]>(`/api/sites/${siteId}/components`)
  }

  async getComponent(siteId: string, componentId: string) {
    return this.request(`/api/sites/${siteId}/components/${componentId}`)
  }

  async createComponent(
    siteId: string,
    data: { name: string; displayName: string; previewField?: string }
  ) {
    return this.request(`/api/sites/${siteId}/components`, { method: "POST", body: data })
  }

  async updateComponent(
    siteId: string,
    componentId: string,
    data: { name?: string; displayName?: string; previewField?: string }
  ) {
    return this.request(`/api/sites/${siteId}/components/${componentId}`, {
      method: "PUT",
      body: data
    })
  }

  async deleteComponent(siteId: string, componentId: string) {
    return this.request(`/api/sites/${siteId}/components/${componentId}`, { method: "DELETE" })
  }

  // Component Fields
  async createField(
    siteId: string,
    componentId: string,
    data: {
      name: string
      fieldType: string
      order: string
      displayName: string
    }
  ) {
    return this.request(`/api/sites/${siteId}/components/${componentId}/fields`, {
      method: "POST",
      body: data
    })
  }

  async updateField(
    siteId: string,
    componentId: string,
    fieldKey: string,
    data: {
      fieldKey?: string
      fieldType?: string
      order?: string
      required?: boolean
      description?: string | null
      displayName?: string | null
      defaultValue?: string | number | boolean | null
      componentWhitelist?: string[]
      options?: { optionName: string; optionValue: string }[]
    }
  ) {
    return this.request(`/api/sites/${siteId}/components/${componentId}/fields/${fieldKey}`, {
      method: "PUT",
      body: data
    })
  }

  async deleteField(siteId: string, componentId: string, fieldKey: string) {
    return this.request(`/api/sites/${siteId}/components/${componentId}/fields/${fieldKey}`, {
      method: "DELETE"
    })
  }

  // Languages
  async listLanguages(siteId: string) {
    return this.request<any[]>(`/api/sites/${siteId}/languages`)
  }

  async addLanguage(siteId: string, languageCode: string) {
    return this.request(`/api/sites/${siteId}/languages`, {
      method: "POST",
      body: { languageCode }
    })
  }

  async removeLanguage(siteId: string, languageCode: string) {
    return this.request(`/api/sites/${siteId}/languages/${languageCode}`, {
      method: "DELETE"
    })
  }
}
