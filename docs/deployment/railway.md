# Railway deployment

Railway can run LibreStaff from the included Dockerfile. Treat this as a community recipe and check
Railway's current documentation for exact dashboard names and billing behavior.

1. Create a project with a PostgreSQL service and a service connected to this repository.
2. Configure the application service to build with `Dockerfile`.
3. Add a persistent volume mounted at `/app/storage/media` and set
   `MEDIA_STORAGE_DIR=/app/storage/media`.
4. Set `DATABASE_URL` from the PostgreSQL service and configure every required application secret.
5. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_URL` to the public HTTPS domain.
6. Run `pnpm db:migrate` as a one-off command before directing traffic to each new release.
7. If scheduled jobs are needed, create a second service from the same image with the start command
   `node scripts/cron-scheduler.mjs`. Give it `DATABASE_URL`, `CRON_SECRET`, and the application's
   private URL as `SCHEDULER_APP_URL`.

Keep the application at one replica when using its local volume. Before upgrades, back up the
managed database and the media volume, and verify the provider's restore process.
