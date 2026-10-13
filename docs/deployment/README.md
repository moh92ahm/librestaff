# Deployment guide

LibreStaff is portable wherever a host can provide Node.js, PostgreSQL, persistent file storage,
and a way to run database migrations. Docker Compose is the most complete documented deployment
because it includes all of those pieces plus Nginx and the optional scheduler.

| Option | Best for | Persistent media | Notes |
| --- | --- | --- | --- |
| [Docker Compose](docker.md) | A VPS or dedicated server | Included volumes | Recommended self-hosting path |
| [Node.js on a VPS](vps.md) | Operators managing services directly | Server directory | Maximum control without containers |
| [Railway](railway.md) | Managed app and database services | Add a volume | Use the Dockerfile |
| [Render](render.md) | Managed web service and PostgreSQL | Add a persistent disk | Use the Docker runtime |
| [Fly.io](flyio.md) | Container deployment near users | Add a Fly Volume | Keep one app machine per local volume |
| [Vercel](vercel.md) | Evaluation or a custom object-storage fork | Not available locally | Uploads are not production-ready as shipped |

These are community deployment guides, not guarantees from the hosting providers. Provider
features and dashboards change; check the provider's current documentation before production use.

## Requirements shared by every production deployment

- Node.js 20.19 or newer, or the included container image
- PostgreSQL 15 or newer
- HTTPS and a stable public application URL
- Persistent storage mounted at `MEDIA_STORAGE_DIR`
- `pnpm db:migrate` run once for each deployed release
- Strong, independent values for every secret in `.env.example`
- Backups of PostgreSQL and media taken and restored as one consistent set
- A scheduler process or external cron service if scheduled jobs are enabled

Do not run multiple application replicas against separate local media directories. Use one app
replica, a shared filesystem, or implement an object-storage backend first.

For professional deployment, migration, backup, or maintenance help, see
[commercial support](https://yourwebsite.com/librestaff).
