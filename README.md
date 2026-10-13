# LibreStaff

LibreStaff is a self-hosted employee operations application built with Next.js, PostgreSQL, and
Drizzle ORM. It combines employee records, organization structure, leave, payroll, inventory,
applicants, announcements, calendars, notifications, and configurable permissions in one app.

Licensed under [AGPL-3.0-only](LICENSE).

## Features

- Employee profiles, documents, employment details, and activity history
- Departments, reporting hierarchy, dotted-line managers, and organization chart
- Administrator, member, and custom roles with resource/action permission scopes
- Invitation-only account creation after protected first-time setup
- Leave requests, approval scopes, calendars, and leave policy settings
- Payroll settings, payroll generation, additional payments, and expense reporting
- Inventory assignment, status history, images, and employee activity
- Public applicant intake with private CV storage and applicant management
- Announcements, channels, mentions, attachments, comments, and targeted events
- In-app and email notification workflows
- Company branding, languages, themes, SMTP settings, and scheduled jobs
- Responsive desktop and mobile interfaces

## Screenshots

Screenshots are intentionally not committed yet because LibreStaff starts with an empty database and
no demo seed data. Maintainers can add sanitized screenshots under `docs/screenshots/` after creating
a non-production demo workspace. Never capture real employee or applicant information.

## Technology

- Next.js 16 App Router and React 19
- NextAuth v5 credentials authentication
- PostgreSQL with Drizzle ORM and Drizzle Kit migrations
- Tailwind CSS 4 and Radix-based UI components
- React Hook Form and Zod
- Vitest integration tests and Playwright browser tests
- Optional Docker Compose and Nginx deployment

## Requirements

- Node.js 20.19 or newer
- pnpm 9 or 10
- PostgreSQL 15 or newer

## Quick Start

1. Install dependencies and create the local environment file:

   ```bash
   pnpm install
   cp .env.example .env
   ```

2. Set at least these values in `.env`:

   ```env
   DATABASE_URL=postgresql://librestaff_user:librestaff_pass@127.0.0.1:5432/librestaff_db
   NEXTAUTH_SECRET=replace-with-a-long-random-secret
   SETUP_SECRET=replace-with-a-different-long-random-secret
   NEXTAUTH_URL=http://localhost:3000
   EMAIL_SETTINGS_ENCRYPTION_KEY=replace-with-another-random-secret
   ```

   Generate secrets with `openssl rand -base64 32`.

3. Start PostgreSQL, apply the schema, and run LibreStaff:

   ```bash
   docker compose up -d db
   pnpm db:push
   pnpm dev
   ```

4. Open `http://localhost:3000`. An empty installation redirects to `/setup`. Enter the configured
   `SETUP_SECRET` and create the first administrator account.

After setup, public signup is closed. Administrators create time-limited, single-use invitations
that are bound to a recipient email address and selected role.

## Configuration

The complete template is in [.env.example](.env.example). Important values include:

| Variable                        | Purpose                                             |
| ------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`                  | PostgreSQL connection string                        |
| `NEXTAUTH_SECRET`               | Signs and encrypts authentication data              |
| `NEXTAUTH_URL`                  | Canonical application URL                           |
| `SETUP_SECRET`                  | Authorizes creation of the first administrator      |
| `EMAIL_SETTINGS_ENCRYPTION_KEY` | Encrypts SMTP credentials stored in PostgreSQL      |
| `CRON_SECRET`                   | Protects scheduled-job endpoints                    |
| `MEDIA_STORAGE_DIR`             | Persistent directory for private uploads            |
| `MAX_FILE_SIZE`                 | Maximum upload size in bytes                        |
| `TRUST_PROXY_HEADERS`           | Trust client-IP headers only behind a trusted proxy |

Use a different random value for every secret. Do not commit `.env` files.

## Authentication and Authorization

- `admin` has full access and is the only role that can assign roles.
- `member` has standard own-profile access.
- Custom roles receive explicit resource/action scopes.
- Department management is assigned independently from access roles.
- Non-admin users cannot promote themselves or edit their own administrative employment fields.
- Disabled users, disabled roles, and role changes are refreshed from the database on authenticated
  requests rather than remaining valid in a stale session.

The initial setup account is protected from accidental removal or demotion. Passwords must contain
at least 15 characters.

## Email

SMTP settings are managed inside LibreStaff at `/settings/email`. The app supports generic SMTP,
authenticated SMTP, and relay configurations. Test the configuration before enabling delivery.

`EMAIL_SETTINGS_ENCRYPTION_KEY` must be present in every application instance that reads the saved
SMTP credentials. Changing it after saving SMTP settings makes the stored secret unreadable.

## Media Storage

Uploads are stored on the server filesystem under `MEDIA_STORAGE_DIR`, with metadata in PostgreSQL.
Private files are served through permission-aware media routes.

The media directory must be persistent and shared by every application instance. Back up PostgreSQL
and the media directory together. Database-only backups do not include uploaded documents.

### Important Vercel limitation

Vercel functions have an ephemeral filesystem. The current filesystem media backend therefore does
not provide durable uploads on Vercel. Before using Vercel for a real deployment, implement an object
storage backend such as S3-compatible storage and keep media private with signed or authorized reads.
Without that adaptation, use a host with a persistent volume or the included Docker deployment.

## Docker Deployment

The Docker setup is optional and consists of PostgreSQL, the app, a migration job, a scheduler, and
Nginx. It persists database and media data in named volumes. The full procedure, including local
builds, published images, TLS, backups, and upgrades, is in the
[Docker Compose deployment guide](docs/deployment/docker.md).

1. Copy `.env.example` to a server-side `.env` and replace every placeholder.
2. Set `NGINX_SERVER_NAME` and `NGINX_CERT_NAME`.
3. Build the image and run migrations:

   ```bash
   docker compose build app
   docker compose run --rm migrate
   ```

4. Start or update the stack:

   ```bash
   docker compose up -d --remove-orphans
   ```

The included Nginx configuration overwrites forwarded client-IP headers, and Compose enables
`TRUST_PROXY_HEADERS` for that trusted path. Do not expose the app container directly while relying
on those headers.

Tagged releases also publish `ghcr.io/moh92ahm/librestaff`. Pin `CONTAINER_IMAGE` and `IMAGE_TAG`
to a release if you prefer a registry image over building from source.

## Deploying on Another Next.js Host

LibreStaff can run on any platform that provides:

- A long-running Node.js 20.19+ process
- PostgreSQL
- A persistent filesystem mounted at `MEDIA_STORAGE_DIR`, or a custom object-storage implementation
- A way to invoke migrations before the new application version starts
- A scheduler or external cron service for optional background jobs

Typical commands are:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

Do not run multiple application replicas with separate local media directories.

See the [deployment guide](docs/deployment/README.md) for Docker Compose, a direct Node.js VPS,
Railway, Render, Fly.io, and Vercel-specific guidance. The provider recipes are intentionally
optional; LibreStaff does not automatically deploy to or modify anyone's infrastructure.

## Continuous Integration and Releases

Pull requests and pushes to `main` run lint, integration tests, and a production build in GitHub
Actions. CI validates the repository only; it never deploys an installation.

Pushing a semantic version tag such as `v1.0.0` builds a multi-architecture container and publishes
release tags to GitHub Container Registry. Dependabot checks pnpm dependencies, GitHub Actions, and
Docker base images weekly. Review and merge its pull requests like any other code change.

## Database and Migrations

```bash
pnpm db:push       # local schema iteration
pnpm db:migrate    # apply committed migrations
pnpm db:studio     # open Drizzle Studio
```

Use `db:push` for local development. Use committed migrations and `db:migrate` for shared or
production databases.

## Scheduled Jobs

The included scheduler service calls protected `/api/jobs/*` routes. External schedulers may call
the same routes with:

```bash
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.example/api/jobs/birthday-notifications
```

The secret is accepted only through the `Authorization: Bearer` header. Available jobs include
birthday notifications, calendar workflow events, recurring expense payments, payroll generation,
and notification delivery. Review `scripts/cron-scheduler.mjs` for the bundled schedule.

## Updating an Installation

Before every upgrade:

1. Read the release notes.
2. Back up PostgreSQL and `MEDIA_STORAGE_DIR` together.
3. Install the new dependency lockfile.
4. Apply migrations before starting the new app version.
5. Run the test and build checks appropriate for your deployment.

For a source checkout:

```bash
git fetch --tags origin
git switch main
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm test:int
pnpm build
```

For Docker, pull the chosen image tag, run `docker compose run --rm migrate`, and then recreate the
services. Avoid deploying the floating `latest` tag when reproducible rollbacks matter.

## Keeping a Company Fork Updated

Keep company-specific branding, integrations, and business rules in a separate repository. Add the
public project as an `upstream` remote once:

```bash
git remote add upstream https://github.com/moh92ahm/librestaff.git
git fetch upstream
```

To bring public changes into the company repository:

```bash
git switch main
git switch -c update/librestaff-v1.x
git fetch upstream
git merge upstream/main
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm test:int
pnpm build
```

Resolve conflicts on the update branch, review migrations carefully, and merge it through the
company repository's normal review process. Never force-push the company branch merely to match
upstream, and never copy production secrets or employee data back into the public repository.

## Testing and Quality Checks

```bash
pnpm lint
pnpm test:int
pnpm test:e2e
pnpm build
pnpm audit
```

Playwright starts the development server automatically unless one is already running on
`http://localhost:3000`.

## Project Structure

- `src/app`: pages, layouts, Server Actions, and API routes
- `src/app/(dashboard)`: administrative and scoped-management pages
- `src/app/(employee)`: employee-facing pages
- `src/app/(public)`: setup, signup, and applicant routes
- `src/components`: reusable and domain UI components
- `src/db/schema`: PostgreSQL schema by domain
- `src/lib`: authorization, business logic, media, notifications, and utilities
- `drizzle`: committed migration files and metadata
- `tests/int`: Vitest integration tests
- `tests/e2e`: Playwright browser tests

## Commercial Services

LibreStaff is free and open-source software that you can deploy, modify, and maintain yourself under
the terms of the AGPL-3.0-only license. The public documentation is intended to provide a practical
self-hosting path without requiring a commercial agreement.

Organizations that prefer professional assistance can request services from the project maintainer,
including:

- Production deployment and infrastructure configuration
- PostgreSQL, persistent media, email, TLS, scheduled jobs, and backup setup
- Version upgrades, security maintenance, monitoring, and restore testing
- Data migration, custom branding, integrations, and feature development
- Priority support and ongoing maintenance arrangements

[Request LibreStaff deployment or support](https://yourwebsite.com/librestaff)

Commercial services are separate from the community project and do not change the open-source
license or restrict self-hosting.

## Security

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md). Do not publish sensitive
details in a GitHub issue.

## Community

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.
- Ask questions and share early ideas in
  [GitHub Discussions](https://github.com/moh92ahm/librestaff/discussions).
- Review [SUPPORT.md](SUPPORT.md) for support scope and safe diagnostic sharing.
- Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

LibreStaff is distributed under the GNU Affero General Public License v3.0 only. If you modify it and
offer the modified software over a network, review the AGPL source-availability obligations. See
[LICENSE](LICENSE) for the complete license text.
