# Zeitword Codebase Guidelines for AI Agents

## Build/Lint/Test Commands

- **Dev**: `bun dev` or `npm run dev` - Start development server
- **Build**: `bun run build` or `npm run build` - Build for production
- **Database**: `bun run db:generate` and `bun run db:migrate` - Generate and run migrations
- **No test runner configured** - Add tests as needed

## Code Style & Conventions

- **Framework**: Nuxt 3 with Vue 3 Composition API (`<script setup>`)
- **TypeScript**: Strict mode, use explicit types for props/emits/function params
- **Imports**: Use `~~/` for root imports, organize by: external deps, then internal modules
- **Components**: Prefix with `d-` for design system, `z-` for app-specific components
- **Formatting**: Prettier with no semicolons, double quotes, 2-space indent, 100 char lines
- **CSS**: Tailwind CSS v4 with custom design tokens (neutral, danger, success, warn colors)
- **API Routes**: Use Zod for validation, return proper HTTP errors with `createError()`
- **Database**: Drizzle ORM with PostgreSQL, use transactions for multi-table operations
- **Auth**: Use `requireUserSession()` for protected routes, check `secure.organisationId`
- **Error Handling**: Always validate inputs, use try-catch for DB operations, return meaningful errors
- **File Naming**: kebab-case for files, PascalCase for components, camelCase for functions/variables
