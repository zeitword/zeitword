import { uuidv7 } from "uuidv7";
import { LexoRank } from "lexorank";
export class ZeitwordApi {
    apiUrl;
    token;
    componentCache = new Map();
    languageCache = new Map();
    constructor(apiUrl, token) {
        this.apiUrl = apiUrl;
        this.token = token;
    }
    async getComponentNameMap(siteId) {
        if (this.componentCache.has(siteId)) {
            return this.componentCache.get(siteId);
        }
        const components = await this.listComponents(siteId);
        const map = new Map();
        for (const c of components) {
            map.set(c.id, c.name);
        }
        this.componentCache.set(siteId, map);
        return map;
    }
    invalidateComponentCache(siteId) {
        if (siteId) {
            this.componentCache.delete(siteId);
        }
        else {
            this.componentCache.clear();
        }
    }
    invalidateLanguageCache(siteId) {
        if (siteId) {
            this.languageCache.delete(siteId);
        }
        else {
            this.languageCache.clear();
        }
    }
    async getValidLanguages(siteId) {
        if (this.languageCache.has(siteId)) {
            return this.languageCache.get(siteId);
        }
        const languages = await this.listLanguages(siteId);
        const codes = new Set(languages.map((l) => l.code));
        this.languageCache.set(siteId, codes);
        return codes;
    }
    async validateLanguage(siteId, language) {
        const valid = await this.getValidLanguages(siteId);
        if (!valid.has(language)) {
            const available = [...valid].join(", ");
            throw new Error(`Language "${language}" is not enabled for this site. Available languages: ${available || "(none)"}`);
        }
    }
    async validateContentLanguages(siteId, content) {
        const valid = await this.getValidLanguages(siteId);
        for (const key of Object.keys(content)) {
            if (!valid.has(key)) {
                const available = [...valid].join(", ");
                throw new Error(`Language "${key}" in content is not enabled for this site. Available languages: ${available || "(none)"}`);
            }
        }
    }
    // ── Content Enrichment ─────────────────────────────────────────────
    isBlock(obj) {
        return (typeof obj === "object" &&
            obj !== null &&
            typeof obj.componentId === "string");
    }
    async enrichBlocks(siteId, blocks) {
        const nameMap = await this.getComponentNameMap(siteId);
        let lastOrder = LexoRank.middle();
        for (const block of blocks) {
            if (this.isBlock(block)) {
                if (block.order && typeof block.order === "string") {
                    try {
                        lastOrder = LexoRank.parse(block.order);
                    }
                    catch {
                        lastOrder = lastOrder.genNext();
                    }
                }
            }
        }
        for (const block of blocks) {
            if (!this.isBlock(block))
                continue;
            if (!block.id) {
                block.id = uuidv7();
            }
            if (!block.componentName && block.componentId) {
                const name = nameMap.get(block.componentId);
                if (name) {
                    block.componentName = name;
                }
            }
            if (!block.order || typeof block.order !== "string") {
                lastOrder = lastOrder.genNext();
                block.order = lastOrder.toString();
            }
            if (block.content && typeof block.content === "object") {
                for (const value of Object.values(block.content)) {
                    if (Array.isArray(value)) {
                        await this.enrichBlocks(siteId, value);
                    }
                }
            }
        }
        return blocks;
    }
    async enrichContent(siteId, content) {
        for (const lang of Object.keys(content)) {
            const langContent = content[lang];
            if (typeof langContent !== "object" || langContent === null)
                continue;
            if (Array.isArray(langContent.blocks)) {
                await this.enrichBlocks(siteId, langContent.blocks);
            }
            for (const [key, value] of Object.entries(langContent)) {
                if (key === "blocks")
                    continue;
                if (Array.isArray(value)) {
                    await this.enrichBlocks(siteId, value);
                }
            }
        }
        return content;
    }
    normalizeContent(obj) {
        if (obj === null || obj === undefined)
            return obj;
        if (typeof obj !== "object")
            return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => this.normalizeContent(item));
        }
        const keys = Object.keys(obj);
        if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
            return Object.values(obj).map(item => this.normalizeContent(item));
        }
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = this.normalizeContent(value);
        }
        return result;
    }
    async fetchStoryContent(siteId, storyId) {
        const story = await this.getStory(siteId, storyId, { full: true });
        return this.normalizeContent(story?.content || {});
    }
    async putStoryContent(siteId, storyId, content) {
        return this.request(`/api/sites/${siteId}/stories/${storyId}`, {
            method: "PUT",
            body: { content }
        });
    }
    regenerateOrders(blocks) {
        let rank = LexoRank.middle();
        for (const block of blocks) {
            if (this.isBlock(block)) {
                block.order = rank.toString();
                rank = rank.genNext();
            }
        }
    }
    async request(path, options = {}) {
        const url = new URL(path, this.apiUrl);
        if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
                if (value !== undefined)
                    url.searchParams.set(key, value);
            }
        }
        const res = await fetch(url.toString(), {
            method: options.method || "GET",
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json"
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            let message = `HTTP ${res.status}: ${res.statusText}`;
            try {
                const json = JSON.parse(text);
                if (json.statusMessage)
                    message = json.statusMessage;
                if (json.message)
                    message = json.message;
            }
            catch {
                if (text)
                    message = text;
            }
            throw new Error(message);
        }
        return res.json();
    }
    // Sites
    async listSites() {
        return this.request("/api/sites");
    }
    async getSite(siteId) {
        return this.request(`/api/sites/${siteId}`);
    }
    async createSite(data) {
        return this.request("/api/sites", { method: "POST", body: data });
    }
    async updateSite(siteId, data) {
        return this.request(`/api/sites/${siteId}`, { method: "PUT", body: data });
    }
    async deleteSite(siteId) {
        return this.request(`/api/sites/${siteId}`, { method: "DELETE" });
    }
    // Stories
    async listStories(siteId, params) {
        return this.request(`/api/sites/${siteId}/stories`, { params: params });
    }
    async getStory(siteId, storyId, options) {
        const story = await this.request(`/api/sites/${siteId}/stories/${storyId}`);
        if (options?.full)
            return story;
        // Shallow mode: strip block content down to summaries
        if (story.content && typeof story.content === "object") {
            for (const lang of Object.keys(story.content)) {
                const langContent = story.content[lang];
                if (!langContent || typeof langContent !== "object")
                    continue;
                if (Array.isArray(langContent.blocks)) {
                    langContent.blocks = langContent.blocks.map((b) => ({
                        id: b.id,
                        componentName: b.componentName,
                        componentId: b.componentId,
                        order: b.order,
                    }));
                }
            }
        }
        return story;
    }
    async getStoryChildren(siteId, storyId) {
        return this.request(`/api/sites/${siteId}/stories/${storyId}/children`);
    }
    async createStory(siteId, data) {
        const body = { slug: data.slug, title: data.title };
        if (data.type)
            body.type = data.type;
        if (data.componentId)
            body.componentId = data.componentId;
        if (data.content) {
            await this.validateContentLanguages(siteId, data.content);
            body.content = await this.enrichContent(siteId, data.content);
        }
        const story = await this.request(`/api/sites/${siteId}/stories`, { method: "POST", body });
        return { id: story.id, slug: story.slug, title: story.title, componentId: story.componentId };
    }
    async updateStory(siteId, storyId, data) {
        return this.request(`/api/sites/${siteId}/stories/${storyId}`, {
            method: "PUT",
            body: data
        });
    }
    async updateStoryContent(siteId, storyId, language, langContent) {
        await this.validateLanguage(siteId, language);
        const content = await this.fetchStoryContent(siteId, storyId);
        content[language] = langContent;
        await this.enrichContent(siteId, content);
        await this.putStoryContent(siteId, storyId, content);
        return { success: true, storyId, language };
    }
    async addBlock(siteId, storyId, language, block, position = "end") {
        await this.validateLanguage(siteId, language);
        const storyContent = await this.fetchStoryContent(siteId, storyId);
        if (!storyContent[language])
            storyContent[language] = { blocks: [] };
        if (!Array.isArray(storyContent[language].blocks))
            storyContent[language].blocks = [];
        const blocks = storyContent[language].blocks;
        const nameMap = await this.getComponentNameMap(siteId);
        const newBlock = {
            id: uuidv7(),
            componentId: block.componentId,
            componentName: nameMap.get(block.componentId) || "",
            content: block.content,
            order: ""
        };
        if (position === "start") {
            blocks.unshift(newBlock);
        }
        else if (position.startsWith("before:")) {
            const targetId = position.slice(7);
            const idx = blocks.findIndex((b) => b.id === targetId);
            if (idx === -1)
                throw new Error(`Block ${targetId} not found`);
            blocks.splice(idx, 0, newBlock);
        }
        else if (position.startsWith("after:")) {
            const targetId = position.slice(6);
            const idx = blocks.findIndex((b) => b.id === targetId);
            if (idx === -1)
                throw new Error(`Block ${targetId} not found`);
            blocks.splice(idx + 1, 0, newBlock);
        }
        else {
            blocks.push(newBlock);
        }
        this.regenerateOrders(blocks);
        await this.enrichBlocks(siteId, [newBlock]);
        await this.putStoryContent(siteId, storyId, storyContent);
        return { success: true, storyId, blockId: newBlock.id, componentName: newBlock.componentName };
    }
    async updateBlock(siteId, storyId, language, blockId, blockContent) {
        await this.validateLanguage(siteId, language);
        const storyContent = await this.fetchStoryContent(siteId, storyId);
        if (!storyContent[language]?.blocks) {
            throw new Error(`No blocks found for language "${language}"`);
        }
        const blocks = storyContent[language].blocks;
        const block = blocks.find((b) => b.id === blockId);
        if (!block)
            throw new Error(`Block ${blockId} not found`);
        block.content = blockContent;
        // Enrich nested blocks (logos, cards, badges, etc.) with id/order/componentName
        for (const value of Object.values(blockContent)) {
            if (Array.isArray(value)) {
                await this.enrichBlocks(siteId, value);
            }
        }
        await this.putStoryContent(siteId, storyId, storyContent);
        return { success: true, storyId, blockId };
    }
    async removeBlock(siteId, storyId, language, blockId) {
        await this.validateLanguage(siteId, language);
        const storyContent = await this.fetchStoryContent(siteId, storyId);
        if (!storyContent[language]?.blocks) {
            throw new Error(`No blocks found for language "${language}"`);
        }
        const blocks = storyContent[language].blocks;
        const idx = blocks.findIndex((b) => b.id === blockId);
        if (idx === -1)
            throw new Error(`Block ${blockId} not found`);
        blocks.splice(idx, 1);
        await this.putStoryContent(siteId, storyId, storyContent);
        return { success: true, storyId, blockId };
    }
    async moveBlock(siteId, storyId, language, blockId, position) {
        await this.validateLanguage(siteId, language);
        const storyContent = await this.fetchStoryContent(siteId, storyId);
        if (!storyContent[language]?.blocks) {
            throw new Error(`No blocks found for language "${language}"`);
        }
        const blocks = storyContent[language].blocks;
        const idx = blocks.findIndex((b) => b.id === blockId);
        if (idx === -1)
            throw new Error(`Block ${blockId} not found`);
        const [block] = blocks.splice(idx, 1);
        if (position === "start") {
            blocks.unshift(block);
        }
        else if (position === "end") {
            blocks.push(block);
        }
        else if (position.startsWith("before:")) {
            const targetId = position.slice(7);
            const targetIdx = blocks.findIndex((b) => b.id === targetId);
            if (targetIdx === -1)
                throw new Error(`Target block ${targetId} not found`);
            blocks.splice(targetIdx, 0, block);
        }
        else if (position.startsWith("after:")) {
            const targetId = position.slice(6);
            const targetIdx = blocks.findIndex((b) => b.id === targetId);
            if (targetIdx === -1)
                throw new Error(`Target block ${targetId} not found`);
            blocks.splice(targetIdx + 1, 0, block);
        }
        else {
            throw new Error(`Invalid position: "${position}". Use "start", "end", "before:blockId", or "after:blockId"`);
        }
        this.regenerateOrders(blocks);
        await this.putStoryContent(siteId, storyId, storyContent);
        return { success: true, storyId, blockId, position };
    }
    async deleteStory(siteId, storyId) {
        return this.request(`/api/sites/${siteId}/stories/${storyId}`, { method: "DELETE" });
    }
    // Components
    async listComponents(siteId) {
        return this.request(`/api/sites/${siteId}/components`);
    }
    async getComponent(siteId, componentId) {
        return this.request(`/api/sites/${siteId}/components/${componentId}`);
    }
    async createComponent(siteId, data) {
        return this.request(`/api/sites/${siteId}/components`, { method: "POST", body: data });
    }
    async updateComponent(siteId, componentId, data) {
        return this.request(`/api/sites/${siteId}/components/${componentId}`, {
            method: "PUT",
            body: data
        });
    }
    async deleteComponent(siteId, componentId) {
        return this.request(`/api/sites/${siteId}/components/${componentId}`, { method: "DELETE" });
    }
    // Component Fields
    async createField(siteId, componentId, data) {
        return this.request(`/api/sites/${siteId}/components/${componentId}/fields`, {
            method: "POST",
            body: data
        });
    }
    async updateField(siteId, componentId, fieldKey, data) {
        return this.request(`/api/sites/${siteId}/components/${componentId}/fields/${fieldKey}`, {
            method: "PUT",
            body: data
        });
    }
    async deleteField(siteId, componentId, fieldKey) {
        return this.request(`/api/sites/${siteId}/components/${componentId}/fields/${fieldKey}`, {
            method: "DELETE"
        });
    }
    // Languages
    async listLanguages(siteId) {
        return this.request(`/api/sites/${siteId}/languages`);
    }
    async addLanguage(siteId, languageCode) {
        const result = await this.request(`/api/sites/${siteId}/languages`, {
            method: "POST",
            body: { code: languageCode }
        });
        this.invalidateLanguageCache(siteId);
        return result;
    }
    async removeLanguage(siteId, languageCode) {
        const result = await this.request(`/api/sites/${siteId}/languages/${languageCode}`, {
            method: "DELETE"
        });
        this.invalidateLanguageCache(siteId);
        return result;
    }
    // ── Assets ──────────────────────────────────────────────────────────
    async listAssets(siteId, options) {
        const params = {};
        if (options?.search)
            params.search = options.search;
        if (options?.type)
            params.type = options.type;
        return this.request(`/api/sites/${siteId}/assets`, { params });
    }
    async createUpload(fileName, fileSize, contentType) {
        return this.request("/api/assets/upload/create", {
            method: "POST",
            body: { fileName, fileSize, contentType }
        });
    }
    async completeUpload(data) {
        return this.request("/api/assets/upload/complete", {
            method: "POST",
            body: data
        });
    }
}
