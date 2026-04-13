export class ZeitwordApi {
    apiUrl;
    token;
    constructor(apiUrl, token) {
        this.apiUrl = apiUrl;
        this.token = token;
    }
    async request(path, options = {}) {
        const url = new URL(path, this.apiUrl);
        if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
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
    async getStory(siteId, storyId) {
        return this.request(`/api/sites/${siteId}/stories/${storyId}`);
    }
    async getStoryChildren(siteId, storyId) {
        return this.request(`/api/sites/${siteId}/stories/${storyId}/children`);
    }
    async createStory(siteId, data) {
        return this.request(`/api/sites/${siteId}/stories`, { method: "POST", body: data });
    }
    async updateStory(siteId, storyId, data) {
        return this.request(`/api/sites/${siteId}/stories/${storyId}`, {
            method: "PUT",
            body: data
        });
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
        return this.request(`/api/sites/${siteId}/languages`, {
            method: "POST",
            body: { languageCode }
        });
    }
    async removeLanguage(siteId, languageCode) {
        return this.request(`/api/sites/${siteId}/languages/${languageCode}`, {
            method: "DELETE"
        });
    }
}
