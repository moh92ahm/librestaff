# Fly.io deployment

Fly.io can build LibreStaff from its Dockerfile and attach persistent storage. Treat this as a
community recipe and verify current Fly.io commands, PostgreSQL options, and pricing before use.

1. Create the Fly application and provision or attach PostgreSQL.
2. Create a Fly Volume and mount it at `/app/storage/media`.
3. Set `MEDIA_STORAGE_DIR=/app/storage/media`, the canonical public URLs, and all application
   secrets with Fly secrets management.
4. Configure the app's internal port as `3000` and require HTTPS at the edge.
5. Run `pnpm db:migrate` in a release command or controlled one-off machine before starting the new
   application release.
6. Run `node scripts/cron-scheduler.mjs` in a separate process or machine if scheduled jobs are
   required. It needs the database URL, cron secret, and a reachable `SCHEDULER_APP_URL`.

Fly Volumes are local to a machine and region. Keep one application machine for filesystem-backed
media unless you provide genuinely shared storage or implement object storage. Back up PostgreSQL
and the volume contents together.
