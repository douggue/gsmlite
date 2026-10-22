#!/bin/sh
# Scheduled jobs for the server (same jobs Vercel Cron runs). CRON_SECRET comes from .env.
set -e
apk add --no-cache curl >/dev/null
job() { echo "$1 curl -fsS -m $2 -H 'Authorization: Bearer ${CRON_SECRET}' http://app:3000/api/cron/$3 >/dev/null 2>&1"; }
{
  job "*/2 * * * *" 110 suppliers     # send orders to suppliers and check their status
  job "*/10 * * * *" 280 maintenance  # payments, holds, auto-refunds, deals, KYC retention, messages
  job "30 7 * * *" 600 content        # content machine drafts (never publishes)
} > /etc/crontabs/root
exec crond -f -l 8
