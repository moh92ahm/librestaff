# Node.js deployment on a VPS

This approach runs LibreStaff and its scheduler as operating-system services. Exact package names
and service users vary by Linux distribution.

## Install and build

Install Node.js 20.19 or newer, pnpm 10, PostgreSQL 15 or newer, and a reverse proxy such as Nginx or
Caddy. Clone the repository into a directory owned by a dedicated unprivileged service account.

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
```

Store production environment variables in a root-readable environment file outside the repository.
Create a persistent media directory writable by the service account and set its absolute path as
`MEDIA_STORAGE_DIR`.

## Run the services

Configure a service manager such as systemd to run these two long-lived processes from the release
directory:

```bash
pnpm start
node scripts/cron-scheduler.mjs
```

The web process needs all application variables. The scheduler needs `DATABASE_URL`, `CRON_SECRET`,
and `SCHEDULER_APP_URL`; set the URL to the private address of the web process. Enable the scheduler
only if scheduled jobs are required.

Proxy public HTTPS traffic to port 3000. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_URL` to the canonical
HTTPS URL. Enable `TRUST_PROXY_HEADERS=true` only when the proxy overwrites, rather than appends
untrusted values to, `X-Forwarded-For` and `X-Real-IP`.

## Operate the installation

- Run one web process unless every replica shares the same media storage.
- Back up PostgreSQL and `MEDIA_STORAGE_DIR` together and test restoration.
- On upgrades, install the locked dependencies, migrate, build, and restart the services.
- Keep the previous release directory for application rollback. Review migrations before assuming a
  database downgrade is safe.
- Limit database and application ports with the host firewall; expose only the reverse proxy.
