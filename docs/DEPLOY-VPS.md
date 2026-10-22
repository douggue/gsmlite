# Running GSMLite on your own server (VPS)

One server runs everything with Docker:

| Service | What it does |
|---|---|
| `db` | PostgreSQL 16 |
| `migrate` | Applies database changes, then stops |
| `app` | The site |
| `caddy` | HTTPS certificates (Let's Encrypt) and the web front |
| `cron` | Scheduled jobs: suppliers every 2 min, maintenance every 10 min, content machine daily |
| `backup` | Database dump + uploaded files every night, kept 14 days |

## 1. Server

- **Size:** Ubuntu 24.04, 2 vCPU, 4 GB RAM, 40 GB disk. Hetzner, DigitalOcean, Vultr and others all work.
- **DNS:** create an `A` record for `gsmlite.com` and one for `www.gsmlite.com`, both pointing to the server's IP.
- **Install Docker:**
  ```sh
  curl -fsSL https://get.docker.com | sh
  ```
- **Open the firewall** for ports 22, 80 and 443 only:
  ```sh
  ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
  ```

## 2. Get the code and the settings

```sh
git clone https://github.com/douggue/gsmlite.git ~/gsmlite
cd ~/gsmlite/deploy
cp ../.env.example .env
nano .env        # fill in section 1 of docs/CREDENTIALS.md, then the rest as you get the keys
```

## 3. Start

```sh
docker compose up -d --build
docker compose logs -f app      # Ctrl+C to stop watching
```

Then:

1. Open `https://gsmlite.com/admin/setup`.
2. Enter `CRON_SECRET` and create the owner account.
3. Set up the authenticator app.

## Updating

```sh
cd ~/gsmlite && git pull && cd deploy && docker compose up -d --build
```

Database changes are applied automatically by `migrate` before the new site starts. With the GitHub secrets from docs/CREDENTIALS.md §9, this happens on every push to `main` that passes CI.

## Backups

- **What:** every night at 03:15, `deploy/backups/` receives `db-YYYY-MM-DD.dump` and `uploads-YYYY-MM-DD.tar.gz`.
- **Copy them off the server.** For example, sync the folder to a storage bucket with `rclone`, or download it regularly.
- **Keep `ENCRYPTION_KEY` safe and separate.** Without it, encrypted files and codes cannot be read.

**Restore the database:**

```sh
docker compose exec -T db pg_restore -U gsmlite -d gsmlite --clean < backups/db-2026-10-22.dump
```

**Restore the files:**

```sh
docker run --rm -v gsmlite_uploads:/u -v "$PWD/backups":/b alpine tar -xzf /b/uploads-2026-10-22.tar.gz -C /u
```

## Health and logs

- **Uptime check:** `https://gsmlite.com/api/health`. Point an uptime monitor (UptimeRobot, free) at it.
- **Logs:** `docker compose logs --since 1h app` (or `cron`, `caddy`).
- **Service status in the admin:** Admin → Security → Services.

## Notes

- **Files** (product images, KYC documents, order files) are stored in the `uploads` volume. Private files are encrypted with `ENCRYPTION_KEY`.
- **Upload size:** order files can be up to 25 MB. Caddy has no limit, so nothing needs changing.
- **Moving off Vercel later:** export the Neon database with `pg_dump`, restore it here, then switch DNS. Images stored on Vercel Blob keep working, because their addresses are allowed.
