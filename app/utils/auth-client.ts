import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { createAuthClient } from "better-auth/vue"

export const authClient = createAuthClient({ plugins: [oauthProviderClient()] })
