#!/usr/bin/env bash
# Wire Supabase Postgres for local dev and Vercel production.
# Usage: ./scripts/setup-db.sh 'postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  echo "Usage: $0 <DATABASE_URL>"
  echo "Get the pooler URI from Supabase → Project Settings → Database (port 6543)."
  exit 1
fi

DATABASE_URL="$1"
printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > .env.local
export DATABASE_URL

echo "→ Pushing Drizzle schema…"
npm run db:push

echo "→ Adding DATABASE_URL to Vercel (production)…"
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL production

echo "→ Redeploying production…"
vercel deploy --prod --yes

echo "Done. Production will persist data on next deploy."
