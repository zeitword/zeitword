export declare function getStoredToken(apiUrl: string): string | null;
export declare function clearStoredToken(): void;
/**
 * Starts a local HTTP server, opens the browser to the Zeitword auth page,
 * and waits for the callback with the token.
 */
export declare function authenticateViaBrowser(apiUrl: string): Promise<string>;
