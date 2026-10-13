# Contributing to LibreStaff

Thank you for helping improve LibreStaff. Contributions can include bug reports, documentation,
translations, tests, accessibility improvements, and code changes.

Use [GitHub Discussions](https://github.com/moh92ahm/librestaff/discussions) for support questions
and early feature ideas. Use an issue when the work is concrete and actionable.

## Before You Share Anything

LibreStaff handles sensitive workforce data. Never include any of the following in an issue, pull
request, screenshot, fixture, log, migration, or commit:

- Real employee, applicant, customer, or company information
- Credentials, tokens, private keys, cookies, connection strings, or `.env` files
- Production database exports, uploaded documents, CVs, payroll values, or internal URLs
- Proprietary code or branding that you do not have permission to publish

Create minimal synthetic examples instead. Report vulnerabilities privately according to
[SECURITY.md](SECURITY.md).

## Development Setup

Requirements and installation instructions are in [README.md](README.md). The short version is:

```bash
pnpm install
cp .env.example .env
docker compose up -d db
pnpm db:push
pnpm dev
```

Use random local-only secrets and a disposable development database.

## Making a Change

1. Search existing issues and discussions first.
2. Fork the repository and create a focused branch from `main`.
3. Use a descriptive branch name such as `fix/invite-expiry` or `feature/inventory-export`.
4. Keep the change focused; avoid unrelated formatting or dependency updates.
5. Add or update tests for behavior changes.
6. Update documentation, translations, and `.env.example` when applicable.
7. Run the relevant checks before opening a pull request.

```bash
pnpm lint
pnpm test:int
pnpm build
```

Run `pnpm test:e2e` when changing user flows or browser behavior.

## Database Changes

- Modify the appropriate schema module under `src/db/schema`.
- Generate and commit a Drizzle migration for changes intended for release.
- Never rewrite a migration that may already have been applied by users.
- Include safe upgrade and rollback considerations in the pull request.
- Test the migration against a disposable database; never submit production data.

## Code Expectations

- Preserve authentication and authorization checks inside Server Actions and API handlers.
- Treat browser-side visibility checks as user experience, not as authorization.
- Validate public and untrusted input on the server.
- Keep private media behind permission-aware routes.
- Avoid adding deployment-provider assumptions to the core application.
- Follow the existing TypeScript, formatting, and component conventions.
- Do not silence lint or type errors merely to make checks pass.

## Pull Requests

A pull request should explain the problem, the chosen solution, security or privacy impact, testing,
and any database or configuration changes. Include sanitized screenshots for visible UI changes.

Maintainers may ask for a smaller scope, additional tests, migration changes, or documentation before
merging. Opening a pull request does not guarantee that it will be accepted.

By contributing, you agree that your contribution is provided under the repository's
[AGPL-3.0-only license](LICENSE) and that you have the right to submit it.
