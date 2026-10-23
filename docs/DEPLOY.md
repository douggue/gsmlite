# Deploying GSMLite to Vercel

Allow about 30 minutes. You need a [Vercel](https://vercel.com) account.

The code is already on GitHub (`douggue/gsmlite`, branch `main`). Vercel builds the site from there, and every push to `main` updates the live site. Keys go only in Vercel → Settings → Environment Variables; never put them in chat or in the code. The full list of keys is in `docs/CREDENTIALS.md`.

> **Your own server instead of Vercel?** See `docs/DEPLOY-VPS.md`.

---

## Step 1: Import the project
1. Vercel → **Add New… → Project**. Connect GitHub if Vercel asks, then **Import** `douggue/gsmlite`.
2. Leave every setting as it is. The build command is in the code: it creates the database tables, then builds the site.
3. Press **Deploy**. **The first build fails with "No database connected". That is expected.** Go on to step 2.

## Step 2: Database and files (your project → **Storage**)
1. **Database:**
   - Create Database → **Neon** (Postgres).
   - Region: **US East (Washington, D.C.)**, the closest to Haiti.
   - Connect it to the project for **all environments**.
   - This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
2. **Files:**
   - Create → **Blob** → name it `gsmlite-files`.
   - Connect it to the project.
   - This adds `BLOB_READ_WRITE_TOKEN`. The store holds product images, payment screenshots, KYC documents and order files. Private files are encrypted before they are stored.

## Step 3: The four required secrets (Settings → **Environment Variables**)
Add each one for **Production, Preview and Development**:

| Name | Value |
|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **another** `openssl rand -base64 32` (44 characters ending in `=`) |
| `CRON_SECRET` | `openssl rand -hex 24`. It is also your one-time setup code in step 6. |
| `NEXT_PUBLIC_SITE_URL` | **Only once you own the domain:** `https://gsmlite.com`. Leave it out until then: the site runs on its `….vercel.app` address. |

> **Save `ENCRYPTION_KEY` in a password manager now, and never change it.** It locks codes, supplier keys, KYC files and the passwords customers type in orders. If you lose it, that data can't be read again.

## Step 4: Connect the domain (Settings → **Domains**)
1. Add `gsmlite.com` and `www.gsmlite.com`, and choose to redirect `www` to `gsmlite.com`.
2. At your domain registrar, create the DNS records Vercel shows. They are usually:
   - an `A` record `@` → `76.76.21.21`
   - a `CNAME` record `www` → `cname.vercel-dns.com`
3. Wait until Vercel shows **Valid Configuration**. This takes a few minutes to a few hours.

> **No domain yet?** Skip this step. Without `NEXT_PUBLIC_SITE_URL` the site works on its `….vercel.app` address: use that address everywhere below instead of gsmlite.com. Once the domain is bought and connected, add `NEXT_PUBLIC_SITE_URL=https://gsmlite.com` and redeploy: emails, links and Google then use gsmlite.com. The `.vercel.app` address keeps working too (it is never redirected).

## Step 5: Deploy again
Deployments → the failed one → **⋯ → Redeploy**. The build takes 2–4 minutes.

Then open `https://gsmlite.com/api/health`. It should show `{"ok":true,"db":"up"}`.

## Step 6: Create the owner account
1. Open `https://gsmlite.com/admin/setup`.
2. For the setup code, enter the `CRON_SECRET` value. Then enter your name, email and a password of 12 characters or more.
3. **Load the demo catalog** is ticked by default. Untick it unless you want example services to try things with.
4. Sign in.
5. Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator or Authy), and **save the backup codes**.

The setup page closes for good once the owner account exists.

## Step 7: Scheduled jobs (important)
The site needs three regular jobs:

| Job | How often | What it does |
|---|---|---|
| `/api/cron/suppliers` | every 2 minutes | sends paid orders to suppliers and checks their results |
| `/api/cron/maintenance` | every 10 minutes | MonCash checks, deposit holds, auto-refunds, deals ending, messages |
| `/api/cron/content` | once a day | content machine drafts |

Vercel's free plan (Hobby) can only run jobs **once a day**. That is enough for `content`, but **not** for `suppliers`, so orders would wait up to a day. Choose one:

### Option A (free): cron-job.org
1. Create an account at https://cron-job.org.
2. Create one job for each URL below:
   - `https://gsmlite.com/api/cron/suppliers`, every 2 minutes
   - `https://gsmlite.com/api/cron/maintenance`, every 10 minutes
3. In each job, open **Advanced → Headers** and add the header `Authorization` with the value `Bearer YOUR_CRON_SECRET`.
4. Run each job once with **Test run**. The answer should be JSON, not `{"error":"unauthorized"}`.

The daily jobs in `vercel.json` (maintenance at 06:00 and content at 07:30 UTC) keep running on Vercel as well.

### Option B: Vercel Pro
Upgrade the project to Pro, then ask Claude to add the two frequent jobs to `vercel.json`. Vercel sends the secret automatically.

## Step 8: Connect the services, one at a time
Each key goes in Environment Variables, followed by **Redeploy**. Where to get each one: `docs/CREDENTIALS.md`. After each one, check that it shows **✓ set** in the admin.

| Turns on | Keys | Also do |
|---|---|---|
| MonCash | `MONCASH_MODE=live`, `MONCASH_CLIENT_ID`, `MONCASH_CLIENT_SECRET` | — |
| Card payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | In Stripe, add the webhook `https://gsmlite.com/api/payments/card/webhook` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Verify `gsmlite.com` in Resend |
| Google sign-in + Search Console | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Add the two redirect addresses (CREDENTIALS.md §4) |
| Telegram | `TELEGRAM_BOT_TOKEN` | In Admin → Settings → Telegram: Send a test message, then Connect the bot |
| Content machine | `ANTHROPIC_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Set the monthly budget in Admin → Content machine |
| Push notifications | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | — |
| Bot check | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | — |
| Error alerts | `SENTRY_DSN` | — |

Supplier keys are **not** set here. Add each supplier in **Admin → Suppliers**.

## Step 9: Before real customers
1. **Settings:** rate, NatCash number, WhatsApp, address, legal details, Telegram.
2. **Suppliers:** add your Dhru supplier, then Test, then Sync. Import services with your markup.
3. **Payment methods:** choose which countries see each method.
4. **Test a full order on your iPhone:** sign up → top up → order an IMEI service → check that the result arrives and appears on the order page.
5. **Uptime:** point an uptime monitor (UptimeRobot, free) at `https://gsmlite.com/api/health`.

## Limits on Vercel
- **File size:** Vercel refuses uploads over **4.5 MB** in one request, so larger KYC videos, order files (firmware dumps) and big product photos fail there. Ask customers for smaller files, or host on your own server, where the limits are 12 MB for documents and 25 MB for order files.
- **Jobs:** without Pro, the frequent jobs need cron-job.org (step 7).

## If something goes wrong
| Problem | Fix |
|---|---|
| Build says "No database connected" | Connect Neon for Production **and** Preview (step 2), then redeploy |
| The `.vercel.app` address jumps to gsmlite.com | An old redirect remembered by the browser: open it in a Private tab, or clear the site's data in Safari settings |
| Setup page: "doesn't match CRON_SECRET" | Copy the value again with no spaces. After changing any variable you must **redeploy** |
| Setup page: "ENCRYPTION_KEY is missing or wrong" | It must be the output of `openssl rand -base64 32` (44 characters ending in `=`) |
| "Invalid origin" when signing in | `NEXT_PUBLIC_SITE_URL` must be exactly `https://gsmlite.com`. Then redeploy |
| Image upload says storage is not configured | Connect the Blob store (step 2), then redeploy |
| Orders stay "Waiting" a long time | The suppliers job isn't running every 2 minutes (step 7) |
| cron-job.org shows `unauthorized` | The header must be `Authorization: Bearer <CRON_SECRET>`, with a space after `Bearer` |
