# Render deployment

Render can run LibreStaff as a Docker web service with managed PostgreSQL. Treat this as a community
recipe and confirm current service and disk behavior in Render's documentation.

1. Create a PostgreSQL database and a Docker web service connected to the repository.
2. Attach a persistent disk at `/app/storage/media` and set
   `MEDIA_STORAGE_DIR=/app/storage/media`.
3. Configure `DATABASE_URL`, the public URLs, and every required secret from `.env.example`.
4. Run `pnpm db:migrate` as the service's pre-deploy command or as a controlled one-off command
   before the new release receives traffic.
5. Use the Dockerfile's default start command for the web service.
6. For scheduled jobs, add a background worker using the same image and
   `node scripts/cron-scheduler.mjs` as its start command. Set `SCHEDULER_APP_URL` to the web
   service's private address.

A disk is normally attached to one service instance, so keep a filesystem-backed LibreStaff web
service at one replica. Back up PostgreSQL and the disk contents together before upgrades.
