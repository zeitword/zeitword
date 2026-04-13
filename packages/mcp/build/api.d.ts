export declare class ZeitwordApi {
    private apiUrl;
    private token;
    constructor(apiUrl: string, token: string);
    private request;
    listSites(): Promise<any[]>;
    getSite(siteId: string): Promise<any>;
    createSite(data: {
        name: string;
        domain?: string;
        defaultLanguage?: string;
    }): Promise<any>;
    updateSite(siteId: string, data: {
        name?: string;
        domain?: string;
    }): Promise<any>;
    deleteSite(siteId: string): Promise<any>;
    listStories(siteId: string, params?: {
        search?: string;
    }): Promise<any>;
    getStory(siteId: string, storyId: string): Promise<any>;
    getStoryChildren(siteId: string, storyId: string): Promise<any>;
    createStory(siteId: string, data: {
        slug: string;
        title: string;
        type?: "story" | "folder";
        content?: Record<string, any>;
        componentId?: string;
    }): Promise<any>;
    updateStory(siteId: string, storyId: string, data: {
        slug?: string;
        title?: string;
        content?: Record<string, any>;
    }): Promise<any>;
    deleteStory(siteId: string, storyId: string): Promise<any>;
    listComponents(siteId: string): Promise<any[]>;
    getComponent(siteId: string, componentId: string): Promise<any>;
    createComponent(siteId: string, data: {
        name: string;
        displayName: string;
        previewField?: string;
    }): Promise<any>;
    updateComponent(siteId: string, componentId: string, data: {
        name?: string;
        displayName?: string;
        previewField?: string;
    }): Promise<any>;
    deleteComponent(siteId: string, componentId: string): Promise<any>;
    createField(siteId: string, componentId: string, data: {
        name: string;
        fieldType: string;
        order: string;
        displayName: string;
    }): Promise<any>;
    updateField(siteId: string, componentId: string, fieldKey: string, data: {
        fieldKey?: string;
        fieldType?: string;
        required?: boolean;
        description?: string | null;
        displayName?: string | null;
        defaultValue?: string | number | boolean | null;
        componentWhitelist?: string[];
        options?: {
            optionName: string;
            optionValue: string;
        }[];
    }): Promise<any>;
    deleteField(siteId: string, componentId: string, fieldKey: string): Promise<any>;
    listLanguages(siteId: string): Promise<any[]>;
    addLanguage(siteId: string, languageCode: string): Promise<any>;
    removeLanguage(siteId: string, languageCode: string): Promise<any>;
}
