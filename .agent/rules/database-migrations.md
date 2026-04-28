# Database and D1 Migration Rules

## Core Principles

- **Never Generate in CI**: Never include `drizzle-kit generate` in deployment or build scripts (e.g., `migrate:remote`, `deploy`). Migrations must be generated during local development only.
- **Commit State**: All generated `.sql` files in the `drizzle/` directory and snapshot files in `drizzle/meta/` must be committed to the repository before deployment.
- **Idempotency**: Remote execution should only use `wrangler d1 migrations apply <BINDING> --remote`. The migration system must be idempotent.
- **Pre-Generation Validation**: Before generating code that interacts with Cloudflare D1, ensure the schema aligns with the latest Drizzle ORM and Cloudflare D1 integration patterns.
- **Type Validation**: Always utilize `wrangler types` to validate environment variables and bindings.

## Workflow

1. **Local Development**: When modifying `src/backend/db/schema.ts`, immediately run `npm run db:generate` locally to generate migration files.
2. **Review & Commit**: Review the generated migration files in `drizzle/` and the updated snapshot files in `drizzle/meta/`, then commit them to version control.
3. **Test Locally**: Apply migrations locally using `npm run migrate:local` to test against a local D1 instance.
4. **Deploy**: Only after committing migration files, deploy to production. The `migrate:remote` script will apply committed migrations to the remote D1 database.

## Anti-Patterns to Avoid

❌ **DO NOT** run `drizzle-kit generate` in CI/CD pipelines or deployment scripts
❌ **DO NOT** deploy without committing migration files
❌ **DO NOT** manually edit generated migration files unless absolutely necessary
❌ **DO NOT** skip local testing before deploying migrations

## Recovery from Failed Migrations

If a migration fails in production due to duplicate table creation:

1. Identify the conflicting table(s) from the error message
2. Use `wrangler d1 execute` to manually drop the problematic table(s)
3. Ensure the correct migration file is committed
4. Re-run `npm run migrate:remote` to apply the migration cleanly
