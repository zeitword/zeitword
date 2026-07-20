// auth.d.ts
declare module "#auth-utils" {
  interface User {
    id: string
    name: string
    email: string
    organisationId: string
  }

  interface UserSession {}

  interface SecureSessionData {
    userId: string
    sessionToken: string
    organisationId: string
  }
}

export {}
