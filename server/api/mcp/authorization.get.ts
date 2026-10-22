import { verifyOAuthQueryParams } from "@better-auth/oauth-provider"

export default defineEventHandler(async (event) => {
  const query = getQuery(event).query
  if (
    typeof query !== "string" ||
    !(await verifyOAuthQueryParams(query, (await useAuth().$context).secret))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or expired authorization request"
    })
  }
  const params = new URLSearchParams(query)
  const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean)
  const session = await useAuth().api.getSession({ headers: authHeaders(event) })
  if (!session)
    return { signedIn: false, scopes, email: null, clientName: null, claims: params.get("claims") }
  const client = await useAuth().api.getOAuthClientPublic({
    headers: authHeaders(event),
    query: { client_id: params.get("client_id") ?? "" }
  })
  return {
    signedIn: true,
    scopes,
    email: session.user.email,
    clientName: client.client_name ?? client.client_id,
    claims: params.get("claims")
  }
})
