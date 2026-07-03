#!/usr/bin/env bash
# Wire Supabase Postgres for local dev and Vercel production.
#
# Usage (paste the FULL URI from Supabase Dashboard — do not hand-build):
#   npm run setup:db -- 'postgresql://postgres.PROJECT_REF:PASSWORD@HOST:6543/postgres'
#
# Prepi project (us-east-1): host must be aws-0-us-east-1.pooler.supabase.com
# Get it from: Supabase → Prepi → Connect → ORM/Drizzle → Transaction pooler (6543)
set -euo pipefail

PREPIE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$PREPIE_DIR/.." && pwd)"
cd "$PREPIE_DIR"

if [ $# -lt 1 ]; then
  echo "Usage: npm run setup:db -- '<DATABASE_URL>'"
  echo ""
  echo "1. Supabase → Prepi → Connect → Transaction pooler (port 6543)"
  echo "2. Copy the entire URI (use Reveal password)"
  echo "3. Paste as the single quoted argument above"
  echo ""
  echo "Prepi pooler host: aws-0-us-east-1.pooler.supabase.com"
  echo "Username format:   postgres.beznhteumkduzxpqyfci"
  exit 1
fi

DATABASE_URL="$1"
HOST="$(node -e "console.log(new URL(process.argv[1]).hostname)" "$DATABASE_URL")"

if [ "$HOST" = "aws-us-east-1.pooler.supabase.com" ]; then
  echo "Error: aws-us-east-1.pooler.supabase.com does not exist."
  echo "Use the URI from Connect — for Prepi it is aws-0-us-east-1.pooler.supabase.com"
  exit 1
fi

printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > .env.local
export DATABASE_URL

echo "→ Verifying connection to $HOST …"
if ! bash scripts/verify-db.sh; then
  echo ""
  echo "Connection failed. After a password reset, copy a fresh URI from Connect."
  exit 1
fi

echo "→ Pushing Drizzle schema (no-op if already applied)…"
if ! npm run db:push; then
  echo ""
  echo "db:push failed. Schema may already exist — check Supabase Table Editor."
  echo "If connection works, you can still deploy; run db:push again after fixing drizzle-kit."
  exit 1
fi

echo "→ Syncing DATABASE_URL to Vercel production…"
cd "$REPO_ROOT"
vercel env rm DATABASE_URL production -y 2>/dev/null || true
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL production

echo "→ Redeploying production (repo root; Vercel rootDirectory=prepie)…"
vercel deploy --prod --yes

echo ""
echo "Done. Visit https://prepie-lovat.vercel.app"
echo "First load seeds the Japan demo trip if the DB is empty."
