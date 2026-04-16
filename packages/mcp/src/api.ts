import { uuidv7 } from "uuidv7"
import { LexoRank } from "lexorank"

export class ZeitwordApi {
  private componentCache = new Map<string, Map<string, string>>()
  private languageCache = new Map<string, Set<string>>()

  constructor(
    private apiUrl: string,
    private token: string
  ) {}

  private async getComponentNameMap(siteId: string): Promise<Map<string, string>> {
    if (this.componentCache.has(siteId)) {
      return this.componentCache.get(siteId)!
    }
    const components = await this.listComponents(siteId)
    const map = new Map<string, string>()
    for (const c of components) {
      map.set(c.id, c.name)
    }
    this.componentCache.set(siteId, map)
    return map
  }

  invalidateComponentCache(siteId?: string) {
    if (siteId) {
      this.componentCache.delete(siteId)
    } else {
      this.componentCache.clear()
    }
  }

  invalidateLanguageCache(siteId?: string) {
    if (siteId) {
      this.languageCache.delete(siteId)
    } else {
      this.languageCache.clear()
    }
  }

  private async getValidLanguages(siteId: string): Promise<Set<string>> {
    if (this.languageCache.has(siteId)) {
      return this.languageCache.get(siteId)!
    }
    const languages = await this.listLanguages(siteId)
    const codes = new Set(languages.map((l: any) => l.code))
    this.languageCache.set(siteId, codes)
    return codes
  }

  private async validateLanguage(siteId: string, language: string): Promise<void> {
    const valid = await this.getValidLanguages(siteId)
    if (!valid.has(language)) {
      const available = [...valid].join(", ")
      throw new Error(
        `Language "${language}" is not enabled for this site. Available languages: ${available || "(none)"}`
      )
    }
  }

  private async validateContentLanguages(siteId: string, content: Record<string, any>): Promise<void> {
    const valid = await this.getValidLanguages(siteId)
    for (const key of Object.keys(content)) {
      if (!valid.has(key)) {
        const available = [...valid].join(", ")
        throw new Error(
          `Language "${key}" in content is not enabled for this site. Available languages: ${available || "(none)"}`
        )
      }
    }
  }

  // ── Content Enrichment ─────────────────────────────────────────────

  private isBlock(obj: any): obj is { componentId: string; content: any; order?: string; id?: string; componentName?: string } {
    return (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.componentId === "string"
    )
  }

  private async enrichBlocks(siteId: string, blocks: any[]): Promise<any[]> {
    const nameMap = await this.getComponentNameMap(siteId)

    // Check if any block is missing an order — if so, regenerate all orders
    const hasMissingOrder = blocks.some(
      (b) => this.isBlock(b) && (!b.order || typeof b.order !== "string")
    )
    if (hasMissingOrder) {
      this.regenerateOrders(blocks)
    }

    for (const block of blocks) {
      if (!this.isBlock(block)) continue

      if (!block.id) {
        block.id = uuidv7()
      }

      if (!block.componentName && block.componentId) {
        const name = nameMap.get(block.componentId)
        if (name) {
          block.componentName = name
        }
      }

      // Recurse into nested block arrays (e.g., cards, buttons)
      if (block.content && typeof block.content === "object") {
        for (const value of Object.values(block.content)) {
          if (Array.isArray(value)) {
            await this.enrichBlocks(siteId, value)
          }
        }
      }
    }

    return blocks
  }

  private async enrichContent(siteId: string, content: Record<string, any>): Promise<Record<string, any>> {
    for (const lang of Object.keys(content)) {
      const langContent = content[lang]
      if (typeof langContent !== "object" || langContent === null) continue

      if (Array.isArray(langContent.blocks)) {
        await this.enrichBlocks(siteId, langContent.blocks)
      }

      for (const [key, value] of Object.entries(langContent)) {
        if (key === "blocks") continue
        if (Array.isArray(value)) {
          await this.enrichBlocks(siteId, value)
        }
      }
    }
    return content
  }

  private normalizeContent(obj: any): any {
    if (obj === null || obj === undefined) return obj
    if (typeof obj !== "object") return obj

    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeContent(item))
    }

    const keys = Object.keys(obj)
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
      return Object.values(obj).map(item => this.normalizeContent(item))
    }

    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.normalizeContent(value)
    }
    return result
  }

  private async fetchStoryContent(siteId: string, storyId: string): Promise<Record<string, any>> {
    const content = await this.request<Record<string, any>>(`/api/sites/${siteId}/stories/${storyId}/content`)
    return this.normalizeContent(content || {})
  }

  private async putStoryContent(siteId: string, storyId: string, content: Record<string, any>): Promise<any> {
    return this.request(`/api/sites/${siteId}/stories/${storyId}`, {
      method: "PUT",
      body: { content }
    })
  }

  private getBlocksArray(langContent: Record<string, any>, fieldKey?: string): any[] {
    if (fieldKey) {
      if (!Array.isArray(langContent[fieldKey])) {
        langContent[fieldKey] = []
      }
      return langContent[fieldKey]
    }
    if (Array.isArray(langContent.blocks)) {
      return langContent.blocks
    }
    const blocksKeys = Object.keys(langContent).filter(
      (k) => Array.isArray(langContent[k]) && langContent[k].some((b: any) => this.isBlock(b))
    )
    if (blocksKeys.length === 1) {
      return langContent[blocksKeys[0]]
    }
    if (blocksKeys.length > 1) {
      throw new Error(
        `Multiple blocks-type fields found (${blocksKeys.join(", ")}). Please specify a fieldKey.`
      )
    }
    langContent.blocks = []
    return langContent.blocks
  }

  private findBlockArrayContaining(langContent: Record<string, any>, blockId: string): { array: any[]; key: string } | null {
    for (const key of Object.keys(langContent)) {
      if (Array.isArray(langContent[key])) {
        const idx = langContent[key].findIndex((b: any) => b.id === blockId)
        if (idx !== -1) {
          return { array: langContent[key], key }
        }
      }
    }
    return null
  }

  private regenerateOrders(blocks: any[]): void {
    let rank = LexoRank.middle()
    for (const block of blocks) {
      if (this.isBlock(block)) {
        block.order = rank.toString()
        rank = rank.genNext()
      }
    }
  }

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
        if (value !== undefined) url.searchParams.set(key, value)
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

  async updateSite(siteId: string, data: { name?: string; domain?: string; defaultLanguage?: string }) {
    return this.request(`/api/sites/${siteId}`, { method: "PUT", body: data })
  }

  async deleteSite(siteId: string) {
    return this.request(`/api/sites/${siteId}`, { method: "DELETE" })
  }

  // Stories
  async listStories(siteId: string, params?: { search?: string }) {
    return this.request(`/api/sites/${siteId}/stories`, { params: params as any })
  }

  async getStory(siteId: string, storyId: string, options?: { full?: boolean }) {
    const story = await this.request<any>(`/api/sites/${siteId}/stories/${storyId}`)
    if (options?.full) return story

    // Shallow mode: strip block content down to summaries
    if (story.content && typeof story.content === "object") {
      for (const lang of Object.keys(story.content)) {
        const langContent = story.content[lang]
        if (!langContent || typeof langContent !== "object") continue
        if (Array.isArray(langContent.blocks)) {
          langContent.blocks = langContent.blocks.map((b: any) => ({
            id: b.id,
            componentName: b.componentName,
            componentId: b.componentId,
            order: b.order,
          }))
        }
      }
    }
    return story
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
    const body: Record<string, any> = { slug: data.slug, title: data.title }
    if (data.type) body.type = data.type
    if (data.componentId) body.componentId = data.componentId
    if (data.content) {
      await this.validateContentLanguages(siteId, data.content)
      body.content = await this.enrichContent(siteId, data.content)
    }
    const story = await this.request<any>(`/api/sites/${siteId}/stories`, { method: "POST", body })
    return { id: story.id, slug: story.slug, title: story.title, componentId: story.componentId }
  }

  async updateStory(
    siteId: string,
    storyId: string,
    data: {
      slug?: string
      title?: string
      componentId?: string
    }
  ) {
    return this.request(`/api/sites/${siteId}/stories/${storyId}`, {
      method: "PUT",
      body: data
    })
  }

  async updateStoryContent(
    siteId: string,
    storyId: string,
    language: string,
    langContent: Record<string, any>
  ) {
    await this.validateLanguage(siteId, language)
    const content = await this.fetchStoryContent(siteId, storyId)
    content[language] = langContent
    await this.enrichContent(siteId, content)
    await this.putStoryContent(siteId, storyId, content)
    return { success: true, storyId, language }
  }

  async addBlock(
    siteId: string,
    storyId: string,
    language: string,
    block: { componentId: string; content: Record<string, any> },
    position: string = "end",
    fieldKey?: string
  ) {
    await this.validateLanguage(siteId, language)
    const storyContent = await this.fetchStoryContent(siteId, storyId)

    if (!storyContent[language]) storyContent[language] = {}

    const blocks = this.getBlocksArray(storyContent[language], fieldKey)
    const nameMap = await this.getComponentNameMap(siteId)
    const newBlock: any = {
      id: uuidv7(),
      componentId: block.componentId,
      componentName: nameMap.get(block.componentId) || "",
      content: block.content,
      order: ""
    }

    if (position === "start") {
      blocks.unshift(newBlock)
    } else if (position.startsWith("before:")) {
      const targetId = position.slice(7)
      const idx = blocks.findIndex((b: any) => b.id === targetId)
      if (idx === -1) throw new Error(`Block ${targetId} not found`)
      blocks.splice(idx, 0, newBlock)
    } else if (position.startsWith("after:")) {
      const targetId = position.slice(6)
      const idx = blocks.findIndex((b: any) => b.id === targetId)
      if (idx === -1) throw new Error(`Block ${targetId} not found`)
      blocks.splice(idx + 1, 0, newBlock)
    } else {
      blocks.push(newBlock)
    }

    this.regenerateOrders(blocks)

    await this.putStoryContent(siteId, storyId, storyContent)
    return { success: true, storyId, blockId: newBlock.id, componentName: newBlock.componentName }
  }

  async updateBlock(
    siteId: string,
    storyId: string,
    language: string,
    blockId: string,
    blockContent: Record<string, any>
  ) {
    await this.validateLanguage(siteId, language)
    const storyContent = await this.fetchStoryContent(siteId, storyId)

    const langContent = storyContent[language]
    if (!langContent) {
      throw new Error(`No content found for language "${language}"`)
    }

    const found = this.findBlockArrayContaining(langContent, blockId)
    if (!found) throw new Error(`Block ${blockId} not found`)

    const block = found.array.find((b: any) => b.id === blockId)
    block.content = blockContent

    for (const value of Object.values(blockContent)) {
      if (Array.isArray(value)) {
        await this.enrichBlocks(siteId, value)
      }
    }

    await this.putStoryContent(siteId, storyId, storyContent)
    return { success: true, storyId, blockId }
  }

  async removeBlock(
    siteId: string,
    storyId: string,
    language: string,
    blockId: string
  ) {
    await this.validateLanguage(siteId, language)
    const storyContent = await this.fetchStoryContent(siteId, storyId)

    const langContent = storyContent[language]
    if (!langContent) {
      throw new Error(`No content found for language "${language}"`)
    }

    const found = this.findBlockArrayContaining(langContent, blockId)
    if (!found) throw new Error(`Block ${blockId} not found`)

    const idx = found.array.findIndex((b: any) => b.id === blockId)
    found.array.splice(idx, 1)

    await this.putStoryContent(siteId, storyId, storyContent)
    return { success: true, storyId, blockId }
  }

  async moveBlock(
    siteId: string,
    storyId: string,
    language: string,
    blockId: string,
    position: string
  ) {
    await this.validateLanguage(siteId, language)
    const storyContent = await this.fetchStoryContent(siteId, storyId)

    const langContent = storyContent[language]
    if (!langContent) {
      throw new Error(`No content found for language "${language}"`)
    }

    const found = this.findBlockArrayContaining(langContent, blockId)
    if (!found) throw new Error(`Block ${blockId} not found`)

    const blocks = found.array
    const idx = blocks.findIndex((b: any) => b.id === blockId)
    const [block] = blocks.splice(idx, 1)

    if (position === "start") {
      blocks.unshift(block)
    } else if (position === "end") {
      blocks.push(block)
    } else if (position.startsWith("before:")) {
      const targetId = position.slice(7)
      const targetIdx = blocks.findIndex((b: any) => b.id === targetId)
      if (targetIdx === -1) throw new Error(`Target block ${targetId} not found`)
      blocks.splice(targetIdx, 0, block)
    } else if (position.startsWith("after:")) {
      const targetId = position.slice(6)
      const targetIdx = blocks.findIndex((b: any) => b.id === targetId)
      if (targetIdx === -1) throw new Error(`Target block ${targetId} not found`)
      blocks.splice(targetIdx + 1, 0, block)
    } else {
      throw new Error(
        `Invalid position: "${position}". Use "start", "end", "before:blockId", or "after:blockId"`
      )
    }

    this.regenerateOrders(blocks)

    await this.putStoryContent(siteId, storyId, storyContent)
    return { success: true, storyId, blockId, position }
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
    const result = await this.request(`/api/sites/${siteId}/languages`, {
      method: "POST",
      body: { code: languageCode }
    })
    this.invalidateLanguageCache(siteId)
    return result
  }

  async removeLanguage(siteId: string, languageCode: string) {
    const result = await this.request(`/api/sites/${siteId}/languages/${languageCode}`, {
      method: "DELETE"
    })
    this.invalidateLanguageCache(siteId)
    return result
  }

  // ── Assets ──────────────────────────────────────────────────────────

  async listAssets(siteId: string, options?: { search?: string; type?: string }) {
    const params: Record<string, string> = {}
    if (options?.search) params.search = options.search
    if (options?.type) params.type = options.type
    return this.request<any>(`/api/sites/${siteId}/assets`, { params })
  }

  async createUpload(fileName: string, fileSize: number, contentType: string) {
    return this.request<{
      key: string
      uploadId: string
      partSize: number
      totalParts: number
      urls: { partNumber: number; url: string }[]
    }>("/api/assets/upload/create", {
      method: "POST",
      body: { fileName, fileSize, contentType }
    })
  }

  async completeUpload(data: {
    key: string
    uploadId: string
    fileName: string
    fileSize: number
    contentType: string
    siteId: string
    parts: { partNumber: number; etag: string }[]
  }) {
    return this.request<{
      id: string
      src: string
      type: string
      fileName: string
    }>("/api/assets/upload/complete", {
      method: "POST",
      body: data
    })
  }
}
