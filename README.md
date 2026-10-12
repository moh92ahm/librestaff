# LibreStaff

LibreStaff is an employee management system built with Next.js, NextAuth, Drizzle ORM, and PostgreSQL.

## Features

- User and employee profile management
- Department and role assignment
- Public applicant intake form with CV upload
- Inventory assignment and status tracking
- Leave request tracking
- Payroll settings and generated payroll records
- Role-based access control for admins, managers, and employees
- Responsive dashboard UI built with Tailwind CSS and shadcn/Radix-style components

## Tech Stack

- Framework: Next.js 16 with App Router
- UI: React 19, Tailwind CSS 4, Radix UI primitives, shadcn-style components
- Authentication: NextAuth v5 credentials provider
- Authorization: simple RBAC with `admin`, `manager`, and `employee` roles
- Database: PostgreSQL
- ORM and migrations: Drizzle ORM and Drizzle Kit
- Forms and validation: React Hook Form and Zod where used
- Testing: Vitest for integration tests and Playwright for browser tests
- Deployment: Docker Compose, nginx, and PostgreSQL

## Project Structure

- `src/app`: App Router pages, layouts, route groups, and API routes
- `src/app/(dashboard)`: admin and manager dashboard routes
- `src/app/(employee)`: employee portal routes
- `src/app/(public)`: public routes such as `/apply`
- `src/app/api`: API route handlers
- `src/auth.ts`: NextAuth configuration
- `proxy.ts`: route protection and role-based redirects
- `src/db`: Drizzle database client and schema exports
- `src/db/schema`: domain schema files for users, roles, departments, applicants, inventory, leaves, media, and payroll
- `src/lib/actions`: server actions for authenticated mutations and dashboard data
- `src/lib/auth.ts`: session helper functions
- `src/lib/auth-guards.ts`: page/API auth guards and response helpers
- `src/lib/rbac.ts`: role helper functions
- `src/components`: reusable UI primitives and domain components
- `drizzle`: generated Drizzle migrations and metadata
- `tests`: Vitest integration tests and Playwright E2E tests

## Local Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the example environment file and set your secrets:

   ```bash
   cp .env.example .env
   ```

3. Make sure `.env` contains a PostgreSQL connection string:

   ```bash
   DATABASE_URL=postgresql://librestaff_user:librestaff_pass@127.0.0.1:5432/librestaff_db
   NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
   NEXTAUTH_URL=http://localhost:3000
   ```

4. Start PostgreSQL. You can use the included Compose file:

   ```bash
   docker compose up -d db
   ```

5. Apply the database schema:

   ```bash
   pnpm db:push
   ```

6. Start the app:

   ```bash
   pnpm dev
   ```

7. Open `http://localhost:3000`.

## Database Commands

- `pnpm db:push`: push the current Drizzle schema to the database
- `pnpm db:migrate`: run generated Drizzle migrations
- `pnpm db:studio`: open Drizzle Studio

Use `db:push` for local iteration. Use generated migrations and `db:migrate` for deployment environments.

## Authentication And Roles

Authentication uses NextAuth credentials login. Users can sign in with email or username. Passwords are verified with `bcryptjs`.

The first account is a bootstrap administrator account. When the users table is empty, `/login`
redirects to `/signup` and the submitted account is assigned the `admin` role. After that,
signup is invite-only: admins generate a one-time invite from the Users page, the recipient opens
`/signup?token=...`, and the invite is locked to that email address and selected role.

Invite emails use the admin-managed SMTP settings at `/settings/email`. Configure Google
Workspace SMTP relay, generic SMTP, or username/password SMTP in the app, then send a test email
and enable sending. SMTP values are not read from deployment environment variables.

The deployment environment must include `EMAIL_SETTINGS_ENCRYPTION_KEY` so saved SMTP secrets can
be encrypted at rest. Generate it with `openssl rand -base64 32`.

For Google Workspace SMTP relay, configure Google Admin to allow the production server IP, then use
these values in `/settings/email`: host `smtp-relay.gmail.com`, port `587`, TLS mode `STARTTLS`,
authentication `No authentication`, and a sender such as `no-reply@example.com`.
The invite token should remain server-generated, stored only as a hash, single-use, and
time-limited regardless of delivery method.

The role model is intentionally simple:

- `admin`: full dashboard access
- `manager`: full dashboard access
- `employee`: employee portal/profile access

`proxy.ts` performs request-level protection and redirects users to the correct area based on their role.

## Public Application Flow

Applicants use `/apply` to submit personal details and a CV. The API route at `POST /api/apply` validates the request, stores the CV in `public/media`, stores media metadata in PostgreSQL, and creates an applicant record.

Authenticated uploads use `POST /api/upload` and `DELETE /api/upload`.

## Docker

Local development is normally run without Docker:

```bash
pnpm dev
```

The included `docker-compose.yml` is an optional self-hosting setup. Environment-specific values live in the server's `.env` file. You may instead deploy the application to Vercel or another platform that supports Next.js and PostgreSQL.

Run Drizzle migrations in a deployed environment:

```bash
docker compose run --rm migrate
```

Start or update the deployed stack:

```bash
docker compose up -d --remove-orphans
```

## Deployment

The repository includes:

- `Dockerfile` for the production app image
- `docker-compose.yml` for optional self-hosting
- `nginx.conf` as a Docker nginx template driven by environment variables

The intended deployment flow is:

1. Build the Next.js app image.
2. Push the image to your preferred container registry.
3. Copy Compose and nginx files to the server.
4. Create the server `.env`.
5. Start PostgreSQL.
6. Run Drizzle migrations with the `migrate` service.
7. Start the app and nginx.

Required production environment values include:

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `EMAIL_SETTINGS_ENCRYPTION_KEY`
- `IMAGE_TAG`
- `CONTAINER_IMAGE`
- `COMPOSE_PROJECT_NAME`
- `NGINX_SERVER_NAME`
- `NGINX_CERT_NAME`
- upload settings such as `MAX_FILE_SIZE` and `ALLOWED_FILE_TYPES`

Example self-hosting values:

```env
COMPOSE_PROJECT_NAME=librestaff_prod
NGINX_SERVER_NAME=librestaff.example.com
NGINX_CERT_NAME=librestaff.example.com
CONTAINER_IMAGE=your-registry/librestaff
```

Use different `COMPOSE_PROJECT_NAME` values for dev and production if they ever run on the same Docker host. Uploaded media is mounted as a persistent Docker volume at `/app/public/media`.

## License

LibreStaff is licensed under the GNU Affero General Public License v3.0 only. See `LICENSE` for the full terms.

## Server Cron Jobs

Protected cron endpoints require `CRON_SECRET` in the server environment. Use the same value in the `Authorization` header:

```bash
CRON_SECRET="replace-with-a-long-random-secret"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.com/api/jobs/birthday-notifications"
```

Required schedules:

- Birthday notifications: runs daily and emits both `birthday.reminder` and `birthday.greeting`.

  ```cron
  5 0 * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/jobs/birthday-notifications"
  ```

- Payroll generation: runs monthly and creates missing payroll records for the selected period.

  ```cron
  10 0 1 * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/jobs/payroll-generation"
  ```

  For a specific period:

  ```bash
  curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.com/api/jobs/payroll-generation?month=06&year=2026"
  ```

- Notification outbox processor: runs every few minutes to turn queued events into in-app/email notifications.

  ```cron
  */2 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/jobs/notification-events?limit=50"
  ```

Use HTTPS in production. The endpoints also accept `?secret=...`, but the Authorization header is preferred.

## Testing

Run integration tests:

```bash
pnpm test:int
```

Run Playwright tests:

```bash
pnpm test:e2e
```

Run the full test suite:

```bash
pnpm test
```

The Playwright config starts `pnpm dev` automatically and reuses an existing server on `http://localhost:3000` when available.
