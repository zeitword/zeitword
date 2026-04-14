export declare class ZeitwordApi {
    private apiUrl;
    private token;
    private componentCache;
    private languageCache;
    constructor(apiUrl: string, token: string);
    private getComponentNameMap;
    invalidateComponentCache(siteId?: string): void;
    invalidateLanguageCache(siteId?: string): void;
    private getValidLanguages;
    private validateLanguage;
    private validateContentLanguages;
    private isBlock;
    private enrichBlocks;
    private enrichContent;
    private normalizeContent;
    private fetchStoryContent;
    private putStoryContent;
    private regenerateOrders;
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
        defaultLanguage?: string;
    }): Promise<any>;
    deleteSite(siteId: string): Promise<any>;
    listStories(siteId: string, params?: {
        search?: string;
    }): Promise<any>;
    getStory(siteId: string, storyId: string, options?: {
        full?: boolean;
    }): Promise<any>;
    getStoryChildren(siteId: string, storyId: string): Promise<any>;
    createStory(siteId: string, data: {
        slug: string;
        title: string;
        type?: "story" | "folder";
        content?: Record<string, any>;
        componentId?: string;
    }): Promise<{
        id: any;
        slug: any;
        title: any;
        componentId: any;
    }>;
    updateStory(siteId: string, storyId: string, data: {
        slug?: string;
        title?: string;
        componentId?: string;
    }): Promise<any>;
    updateStoryContent(siteId: string, storyId: string, language: string, langContent: Record<string, any>): Promise<{
        success: boolean;
        storyId: string;
        language: string;
    }>;
    addBlock(siteId: string, storyId: string, language: string, block: {
        componentId: string;
        content: Record<string, any>;
    }, position?: string): Promise<{
        success: boolean;
        storyId: string;
        blockId: any;
        componentName: any;
    }>;
    updateBlock(siteId: string, storyId: string, language: string, blockId: string, blockContent: Record<string, any>): Promise<{
        success: boolean;
        storyId: string;
        blockId: string;
    }>;
    removeBlock(siteId: string, storyId: string, language: string, blockId: string): Promise<{
        success: boolean;
        storyId: string;
        blockId: string;
    }>;
    moveBlock(siteId: string, storyId: string, language: string, blockId: string, position: string): Promise<{
        success: boolean;
        storyId: string;
        blockId: string;
        position: string;
    }>;
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
        order?: string;
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
    listAssets(siteId: string, options?: {
        search?: string;
        type?: string;
    }): Promise<any>;
    createUpload(fileName: string, fileSize: number, contentType: string): Promise<{
        key: string;
        uploadId: string;
        partSize: number;
        totalParts: number;
        urls: {
            partNumber: number;
            url: string;
        }[];
    }>;
    completeUpload(data: {
        key: string;
        uploadId: string;
        fileName: string;
        fileSize: number;
        contentType: string;
        siteId: string;
        parts: {
            partNumber: number;
            etag: string;
        }[];
    }): Promise<{
        id: string;
        src: string;
        type: string;
        fileName: string;
    }>;
}
