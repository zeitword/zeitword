import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { customSession, jwt } from "better-auth/plugins"
import { and, eq, isNull } from "drizzle-orm"
import { Resend } from "resend"
import { uuidv7 } from "uuidv7"

import type { db } from "./utils/drizzle"

import * as oauthSchema from "./database/oauth-schema"
import {
  accounts,
  authRateLimits,
  organisations,
  organisationMembers,
  sessions,
  users,
  verifications
} from "./database/schema"
import { hashPassword, verifyPassword } from "./utils/password"

export type AuthDatabase = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export function createAuth(
  database: AuthDatabase,
  options: {
    secret: string
    baseURL: string
    resend?: string
    sendPasswordReset?: (data: { email: string; url: string }) => Promise<void>
    backgroundTask?: (task: Promise<unknown>) => void
  }
) {
  return betterAuth({
    appName: "Zeitword",
    secret: options.secret,
    baseURL: options.baseURL,
    disabledPaths: ["/token"],
    database: drizzleAdapter(database, {
      provider: "pg",
      transaction: true,
      schema: {
        ...oauthSchema,
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        rateLimit: authRateLimits
      }
    }),
    advanced: {
      database: { generateId: () => uuidv7() },
      backgroundTasks: options.backgroundTask ? { handler: options.backgroundTask } : undefined,
      // Populated by our Nitro boundary from the socket / explicitly trusted proxy.
      ipAddress: { ipAddressHeaders: ["x-zeitword-client-ip"] }
    },
    user: {
      additionalFields: {
        authVersion: {
          type: "number",
          required: true,
          defaultValue: 0,
          input: false,
          returned: false
        }
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
      additionalFields: {
        organisationId: { type: "string", required: false, input: false },
        membershipVersion: { type: "number", defaultValue: 0, input: false },
        authVersion: {
          type: "number",
          required: true,
          defaultValue: 0,
          input: false,
          returned: false
        }
      }
    },
    emailAndPassword: {
      enabled: true,
      // Onboarding must atomically create the Zeitword organisation as well.
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password)
      },
      sendResetPassword: async ({ user, url }) => {
        const [active] = await database
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
        if (!active) return
        if (options.sendPasswordReset) return options.sendPasswordReset({ email: user.email, url })
        if (!options.resend) throw new Error("Resend is not configured")
        const { error } = await new Resend(options.resend).emails.send({
          from: "Zeitword Support <support@zeitword.com>",
          to: user.email,
          subject: "Reset your Zeitword password",
          text: `Reset your Zeitword password: ${url}\n\nIf you did not request this, you can ignore this email.`
        })
        if (error) throw new Error("Password reset email delivery failed")
      }
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 15 },
        "/request-password-reset": { window: 60, max: 3 }
      }
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const [user] = await database
              .select({ authVersion: users.authVersion })
              .from(users)
              .where(and(eq(users.id, session.userId), isNull(users.deletedAt)))
            if (!user) throw new APIError("UNAUTHORIZED", { message: "Account is unavailable" })
            const [membership] = await database
              .select({
                organisationId: organisationMembers.organisationId,
                version: organisationMembers.authVersion
              })
              .from(organisationMembers)
              .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
              .where(
                and(
                  eq(organisationMembers.userId, session.userId),
                  isNull(organisationMembers.deletedAt),
                  isNull(organisations.deletedAt)
                )
              )
              .orderBy(organisationMembers.createdAt, organisationMembers.id)
              .limit(1)
            return {
              data: {
                ...session,
                organisationId: membership?.organisationId ?? null,
                membershipVersion: membership?.version ?? 0,
                authVersion: user.authVersion
              }
            }
          }
        }
      }
    },
    plugins: [
      jwt(),
      mcp({
        loginPage: "/auth/mcp",
        consentPage: "/auth/mcp",
        resource: `${options.baseURL.replace(/\/$/, "")}/mcp`,
        scopes: ["openid", "profile", "offline_access", "mcp:read", "mcp:write"]
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
      customSession(async ({ user, session }) => {
        const [active] = await database
          .select({
            id: users.id,
            organisationId: sessions.organisationId,
            membershipVersion: sessions.membershipVersion
          })
          .from(users)
          .innerJoin(sessions, and(eq(sessions.userId, users.id), eq(sessions.id, session.id)))
          .where(
            and(
              eq(users.id, user.id),
              eq(users.authVersion, sessions.authVersion),
              isNull(users.deletedAt)
            )
          )
        if (!active) throw new APIError("UNAUTHORIZED", { message: "Account is unavailable" })
        return {
          user,
          session: {
            ...session,
            organisationId: active.organisationId,
            membershipVersion: active.membershipVersion
          }
        }
      })
    ]
  })
}
