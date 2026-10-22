# Credentials checklist

Everything below goes **only** in the hosting environment: on the server in `deploy/.env`, or in Vercel → Project → Settings → Environment Variables. Never paste a key in chat, in the code, or in the admin.
After adding or changing a value, redeploy (server: `docker compose up -d`; Vercel: Redeploy).

`deploy/.env` starts as a copy of `.env.example`, which lists every variable.

## 1. Required to start

| Variable | What it is | How to get it |
|---|---|---|
| `POSTGRES_PASSWORD` | Database password (server only) | `openssl rand -hex 24` |
| `SITE_DOMAIN` | Your domain, e.g. `gsmlite.com` (server only) | Point the domain's A record (and `www`) to the server's IP first |
| `NEXT_PUBLIC_SITE_URL` | `https://gsmlite.com` | — |
| `BETTER_AUTH_SECRET` | Signs sign-in sessions | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Encrypts codes, supplier API keys, KYC files, order files and passwords typed in orders | `openssl rand -base64 32`. **Keep a copy somewhere safe: without it, encrypted data cannot be read.** |
| `CRON_SECRET` | Protects the scheduled jobs; also the code for the first-run page `/admin/setup` | `openssl rand -hex 24` |

On Vercel, also set `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Connecting Neon under Storage sets them for you.

After the first start, open `https://<domain>/admin/setup`, enter `CRON_SECRET` and create the owner account. Then set up the authenticator app.

## 2. Payments

| Variable | Turns on | Where |
|---|---|---|
| `MONCASH_MODE`, `MONCASH_CLIENT_ID`, `MONCASH_CLIENT_SECRET` | MonCash | Digicel MonCash business portal → API. Set `MONCASH_MODE=live` for real money. |
| `STRIPE_SECRET_KEY` | Card payments | Stripe → Developers → API keys (secret key, `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Card payments being confirmed | Stripe → Developers → Webhooks → add endpoint `https://<domain>/api/payments/card/webhook`, event `checkout.session.completed` → signing secret (`whsec_…`) |

NatCash, USDT and your other manual methods are set in **Admin → Payment methods**. They need no key.

## 3. Email (password reset, confirmations, notifications)

| Variable | Where |
|---|---|
| `RESEND_API_KEY` | resend.com → API Keys. Verify your domain in Resend first. |
| `EMAIL_FROM` | e.g. `GSMLite <no-reply@gsmlite.com>`. It must use the verified domain. |

## 4. Google (sign-in, and Search Console for the content machine)

1. In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** (Web application).
2. Authorized redirect URIs:
   - `https://<domain>/api/auth/callback/google` (Continue with Google)
   - `https://<domain>/api/admin/gsc/callback` (Search Console)
3. Enable the **Google Search Console API** for the project.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Then go to Admin → Content machine → **Connect Search Console**, and sign in with the Google account that owns the property.

## 5. Telegram

1. In Telegram, talk to **@BotFather** → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN`.
2. Add the bot as an **admin** of your channel and as a member of the staff group.
3. In Admin → Settings → Telegram:
   - fill in the public link, the channel (`@name`) and the staff chat id;
   - press **Send a test message**;
   - press **Connect the bot**, so customers can link their accounts.

## 6. Content machine

| Variable | Turns on | Where |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI writer | console.anthropic.com → API Keys. The monthly budget is set in Admin → Content machine. |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Keyword research with real search numbers | dataforseo.com → Dashboard → API access. The password is the API password, not the site login. |
| `DATAFORSEO_SANDBOX=1` | Free test numbers | Optional. Remove it to get real data. |

## 7. Optional

| Variable | Turns on | Where |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push notifications on phones | `npx web-push generate-vapid-keys`; the subject is `mailto:your@email` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Bot check on sign-up, sign-in and deposits | Cloudflare → Turnstile → add site |
| `SENTRY_DSN` | Error alerts | sentry.io → project → Client Keys |
| `BLOB_READ_WRITE_TOKEN` | File storage on Vercel | Vercel → Storage → Blob (private). Not needed on the server. |

## 8. Suppliers

Supplier API keys are **not** environment variables. Add each supplier in **Admin → Suppliers** with its site address, username and API key. The key is stored encrypted and never shown again.

## 9. CI auto-deploy (optional)

In GitHub → repository → Settings → Secrets → Actions, add:

- `DEPLOY_HOST`: the server's IP
- `DEPLOY_USER`: the SSH user
- `DEPLOY_SSH_KEY`: a private key whose public key is in the server's `~/.ssh/authorized_keys`

After that, every push to `main` that passes the checks is deployed.

## Where each one is checked in the admin

- **Admin → Settings:** payments, Telegram and the bot connection, each shown as ✓ set or missing.
- **Admin → Content machine → Connections:** AI writer, keyword data and Search Console.
- **Admin → Security → Services:** database, email, storage and the rest.
