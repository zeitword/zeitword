# Better Auth rollout

For the subsequent multi-workspace migration, see [multi-organisation membership](multi-organisation.md). The single-organisation behaviour below describes the initial Better Auth cutover.

Authentication uses Better Auth 1.7.12 with the Drizzle Relations v2 adapter. The app retains one organisation per user. Better Auth's logical models map to the existing `users` table and lowercase plural `auth_accounts`, `auth_sessions`, `auth_verifications`, and `auth_rate_limits` tables. All columns use snake_case.

## Before deploying

1. Back up the database and verify the backup can be restored.
2. Rehearse the migration on a disposable copy. Check for email collisions:

   ```sql
   SELECT lower(email), count(*) FROM users GROUP BY lower(email) HAVING count(*) > 1;
   SELECT lower(email), count(*) FROM user_invitations GROUP BY lower(email) HAVING count(*) > 1;
   ```

   Resolve collisions deliberately; the migration refuses to merge identities.

3. Set `NUXT_AUTH_SECRET` to a random secret of at least 32 characters, shared by all app instances. Set `NUXT_PUBLIC_APP_URL` to the canonical public HTTPS origin and configure `NUXT_RESEND` for recovery and invitation emails.
4. If a reverse proxy terminates requests, configure `NUXT_AUTH_TRUSTED_PROXY_IPS` with its socket IP(s). Only those peers may supply `X-Forwarded-For`; they must overwrite client-supplied forwarding headers. Otherwise rate limiting uses the direct socket address. The internal auth IP header is always replaced at the application boundary.

## Cutover

This migration requires a coordinated deployment, not a rolling mix of old and new auth writers.

1. Stop/drain old app instances and pause writes.
2. Run `mise exec -- npm run db:migrate` using the new checkout.
3. Start the new app with the new environment configuration.
4. Verify login with an existing account, password-reset email delivery and link consumption, invitation acceptance, and logout.

The SQL migration preserves user IDs and copies password hashes verbatim into `auth_accounts` (`provider_id = 'credential'`, `account_id = user ID`). New and old passwords use the same Adonis PHC scrypt implementation. Passwordless users establish credentials through email recovery. Imported email verification is false; password login does not newly require verification.

Existing sessions are invalidated, so everyone signs in once. Old password-reset links are invalidated; request a new link. Pending invitation links retain their secret and expiry and remain usable. PAT and site API key hashes are retained; PATs belonging to archived users or a user's former organisation are revoked during migration.

The migration drops the old session table and password/reset columns after backfilling credentials. Do not restart the old binary against the migrated schema. Rollback requires the pre-cutover database backup and old binary; account for any writes made after cutover before restoring.

## Application behaviour

- Better Auth handles `/api/auth/*` login, logout, session and recovery endpoints. Browser sessions expire after 30 days without sliding refresh; cookie caching is disabled.
- Registration and invitation acceptance remain application-owned endpoints because organisation, account and session writes must commit together. Their Better Auth instance is bound to the same Drizzle transaction. Public Better Auth signup is disabled.
- `organisationId` and `authVersion` are server-owned fields. The common session guard validates the current user, organisation and session version. The same guard protects Better Auth account-management routes.
- Archiving a user revokes browser sessions and PATs and increments the session version. Unarchiving does not restore revoked sessions or PATs. Inviting an archived user does not reactivate or move them until they accept the emailed link. Acceptance rotates their password and revokes old organisation credentials.
- An invitation secret is mailbox proof. The inviter API returns invitation metadata, never its secret. Successful acceptance sets email verification for that account.
- Password reset revokes browser sessions transactionally. It does not revoke independent PATs or site API keys. Those remain separately managed credentials.
- Recovery emails run through the request's background-task lifecycle. Monitor delivery errors; messages and tokens are not written to logs.
- Authentication/onboarding rate limits are stored in PostgreSQL. Expired rate-limit keys can be cleaned up operationally from `auth_rate_limits` once they are older than all configured windows.

## Verification

Run `mise exec -- npm test`, `mise exec -- npm run lint`, and `mise exec -- npm run build`. See [authentication end-to-end tests](../tests/README.md#authentication-migration-end-to-end-test) for the full legacy-data migration and browser/API test.
