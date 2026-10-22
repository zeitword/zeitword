# Multi-organisation membership

Zeitword follows Atlasflow's separation of account identity, workspace membership, and active session workspace. The existing names remain: `users` are people, `auth_accounts` are Better Auth credentials, `organisations` are workspaces, and `organisation_members` joins users to organisations.

- One user can belong to multiple organisations with an independent role in each.
- Workspace creators are owners. Invited users are members. Members can use the CMS and invite people; only owners can archive or restore members. Owners cannot be archived.
- Sessions store the active organisation. Switching validates membership, clears Nuxt's async-data cache, and navigates client-side to the site list. A keyed page resets editors and form state while the app shell stays visible behind a loading indicator. Other sessions retain their own selection.
- Archiving revokes only that membership and its PATs. Sessions in that organisation lose their selection but can still select another organisation. A membership version prevents old session state from becoming valid after restoration.
- Accounts with no active memberships can sign in and create an organisation or accept an invitation.
- Existing accounts must sign in with the invited email before accepting. Acceptance adds membership without changing the account password or removing other memberships. New accounts can be created from the invitation page.
- Invitations are unique per organisation and email, rather than globally per email. Pending legacy links remain valid.

## Migration

`20261022132800_multi-org` backfills one membership for every existing user. The earliest active user (ordered by creation time, then ID) in each organisation becomes its owner. Other users become members. Archived users retain archived memberships, while the account identity becomes usable independently of that old membership. An organisation with no active users has no owner until it is deliberately recovered by an operator.

The migration removes `users.organisation_id`. Back up and rehearse before applying; old dashboard code is incompatible afterward. Public content tables and site API keys are unchanged. No production migration is performed automatically at application startup.

Run the database migration locally with the intended DSN, then deploy the matching application. Follow the coordinated rollout guidance in `better-auth-migration.md`; public content requests do not use dashboard memberships. Rollback requires the matching pre-migration backup and old application.

## Verification

The auth E2E suite runs legacy migrations and backfills, then checks ownership, multiple memberships, session-local selection, forbidden cross-organisation access, scoped PAT revocation, restoration, invitation acceptance without password changes, and actual browser workspace creation/switching. Run it against a fresh disposable database as described in `tests/README.md`.
