#!/bin/sh
# Nightly: database dump + uploaded files (KYC documents and order files are already encrypted). Keeps 14 days.
set -e
day=$(date +%Y-%m-%d)
pg_dump -h db -U gsmlite -d gsmlite -Fc -f "/backups/db-$day.dump"
tar -czf "/backups/uploads-$day.tar.gz" -C /uploads .
find /backups -type f -mtime +14 -delete
