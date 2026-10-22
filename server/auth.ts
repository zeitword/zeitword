import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2"
import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { customSession } from "better-auth/plugins"
import { and, eq, isNull } from "drizzle-orm"
import { Resend } from "resend"
import { uuidv7 } from "uuidv7"

import type { db } from "./utils/drizzle"

import {
  accounts,
  authRateLimits,
  organisations,
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
    database: drizzleAdapter(database, {
      provider: "pg",
      transaction: true,
      schema: {
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
        organisationId: { type: "string", required: true, input: false },
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
        organisationId: { type: "string", required: true, input: false },
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
              .select({ organisationId: users.organisationId, authVersion: users.authVersion })
              .from(users)
              .innerJoin(organisations, eq(organisations.id, users.organisationId))
              .where(
                and(
                  eq(users.id, session.userId),
                  isNull(users.deletedAt),
                  isNull(organisations.deletedAt)
                )
              )
            if (!user) throw new APIError("UNAUTHORIZED", { message: "Account is unavailable" })
            return {
              data: {
                ...session,
                organisationId: user.organisationId,
                authVersion: user.authVersion
              }
            }
          }
        }
      }
    },
    plugins: [
      customSession(async ({ user, session }) => {
        const [active] = await database
          .select({ organisationId: users.organisationId })
          .from(users)
          .innerJoin(organisations, eq(organisations.id, users.organisationId))
          .innerJoin(sessions, and(eq(sessions.userId, users.id), eq(sessions.id, session.id)))
          .where(
            and(
              eq(users.id, user.id),
              eq(users.authVersion, sessions.authVersion),
              eq(users.organisationId, sessions.organisationId),
              isNull(users.deletedAt),
              isNull(organisations.deletedAt)
            )
          )
        if (!active) throw new APIError("UNAUTHORIZED", { message: "Account is unavailable" })
        return { user: { ...user, organisationId: active.organisationId }, session }
      })
    ]
  })
}
