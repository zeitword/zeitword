import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";
const CONFIG_DIR = path.join(os.homedir(), ".config", "zeitword");
const TOKEN_FILE = path.join(CONFIG_DIR, "mcp-token.json");
export function getStoredToken(apiUrl) {
    try {
        if (!fs.existsSync(TOKEN_FILE))
            return null;
        const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
        if (data.apiUrl !== apiUrl)
            return null;
        return data.token;
    }
    catch {
        return null;
    }
}
function storeToken(token, apiUrl) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const data = {
        token,
        apiUrl,
        createdAt: new Date().toISOString()
    };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}
export function clearStoredToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            fs.unlinkSync(TOKEN_FILE);
        }
    }
    catch {
        // Ignore
    }
}
/**
 * Starts a local HTTP server, opens the browser to the Zeitword auth page,
 * and waits for the callback with the token.
 */
export async function authenticateViaBrowser(apiUrl) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost`);
            if (url.pathname === "/callback") {
                const token = url.searchParams.get("token");
                if (token) {
                    storeToken(token, apiUrl);
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Zeitword MCP</title></head>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5;">
                <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <h2 style="margin: 0 0 0.5rem 0; color: #171717;">Authorization Successful</h2>
                  <p style="color: #737373; margin: 0;">You can close this window and return to your terminal.</p>
                </div>
              </body>
            </html>
          `);
                    server.close();
                    resolve(token);
                }
                else {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    res.end("Missing token parameter");
                    server.close();
                    reject(new Error("No token received from authorization"));
                }
            }
            else {
                res.writeHead(404);
                res.end();
            }
        });
        // Listen on a random available port
        server.listen(0, "127.0.0.1", async () => {
            const addr = server.address();
            if (!addr || typeof addr === "string") {
                reject(new Error("Failed to start local server"));
                return;
            }
            const port = addr.port;
            const authUrl = `${apiUrl}/auth/mcp?port=${port}`;
            console.error(`Opening browser for authorization: ${authUrl}`);
            try {
                const open = (await import("open")).default;
                await open(authUrl);
            }
            catch {
                console.error(`Please open this URL in your browser: ${authUrl}`);
            }
        });
        // Timeout after 2 minutes
        setTimeout(() => {
            server.close();
            reject(new Error("Authorization timed out after 2 minutes"));
        }, 120_000);
    });
}
