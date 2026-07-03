#!/usr/bin/env bash
# Quick check that DATABASE_URL in .env.local can reach Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "No .env.local — running in mock mode. Run: npm run setup:db -- '<uri>'"
  exit 1
fi

# Read the value as text rather than sourcing the file, so shell
# metacharacters in the URI ($, &, ?) are never expanded or split.
DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | tail -n 1 | cut -d= -f2- || true)"
DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"
DATABASE_URL="${DATABASE_URL%\'}"; DATABASE_URL="${DATABASE_URL#\'}"
export DATABASE_URL

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is empty in .env.local"
  exit 1
fi

node <<'NODE'
const postgres = require("postgres");
const url = process.env.DATABASE_URL;
const host = new URL(url).hostname;
const sql = postgres(url, { prepare: false, connect_timeout: 10 });
sql`select 1 as ok`
  .then(() => {
    console.log(`Connected OK (${host})`);
    return sql.end();
  })
  .catch((e) => {
    console.error(`Connection failed (${host}):`, e.message);
    process.exit(1);
  });
NODE
