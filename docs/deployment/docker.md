# Docker Compose deployment

The repository includes the application, PostgreSQL, a one-off migration service, the LibreStaff
scheduler, and an Nginx reverse proxy. Named volumes preserve PostgreSQL data and uploaded media.

## Prepare the server

Install Git, Docker Engine, and the Docker Compose plugin. Point the application's DNS record at the
server, clone LibreStaff, and create the deployment configuration:

```bash
git clone https://github.com/moh92ahm/librestaff.git
cd librestaff
cp .env.example .env
```

Replace every placeholder in `.env`. At minimum, set the PostgreSQL password, application URL,
server and certificate names, and all secrets. Generate each secret independently with
`openssl rand -base64 32`.

## Build from source

The default image name is `librestaff:latest`:

```bash
docker compose build app
docker compose run --rm migrate
docker compose up -d --remove-orphans
```

The `migrate` and `scheduler` services reuse the image built for `app`.

## Use a published image

Tagged releases publish multi-architecture images to GitHub Container Registry. Set these values in
`.env`, choosing an immutable release tag:

```env
CONTAINER_IMAGE=ghcr.io/moh92ahm/librestaff
IMAGE_TAG=1.0.0
```

Then deploy it:

```bash
docker compose pull
docker compose run --rm migrate
docker compose up -d --remove-orphans
```

If the package is not public yet, authenticate with `docker login ghcr.io` first.

## TLS and reverse proxy

Mount existing Let's Encrypt certificates through `LETSENCRYPT_DIR` and set
`NGINX_SERVER_NAME` and `NGINX_CERT_NAME`. If no certificate exists, the included Nginx service
creates a temporary self-signed certificate so the stack can start; replace it before public use.

Nginx overwrites forwarded client-IP headers, so Compose safely enables `TRUST_PROXY_HEADERS` for
this topology. Do not expose the `app` container directly while relying on forwarded IP addresses.

## Back up and restore

Back up both PostgreSQL and the `librestaff_media_private` volume. The legacy public media volume
should also be retained if the installation contains files created by an earlier LibreStaff build.
Test restores regularly on a separate database and media directory.

Example logical database backup:

```bash
docker compose exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > librestaff.sql
```

Restore only during a maintenance window and only after verifying the target database and backup.

## Upgrade

```bash
git fetch --tags origin
git switch main
git pull --ff-only
docker compose build app
docker compose run --rm migrate
docker compose up -d --remove-orphans
```

For registry images, change `IMAGE_TAG`, run `docker compose pull`, migrate, and recreate the stack.
Back up first and read the release notes. Keep the previous image tag available for application
rollback; database rollback may require a release-specific procedure.
