#!/usr/bin/env bash
# Applies every migration to a throwaway PostgreSQL and runs the RLS test-suite.
# Requires PostgreSQL server binaries (e.g. /usr/lib/postgresql/16/bin).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGPORT:-54329}"
DIR="$(mktemp -d)"; chmod 755 "$DIR"
RUN=""; [ "$(id -u)" = "0" ] && RUN="su postgres -s /bin/bash -c" && chown postgres "$DIR"
sh() { if [ -n "$RUN" ]; then $RUN "$1"; else bash -c "$1"; fi; }
cleanup() { sh "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null 2>&1 || true"; rm -rf "$DIR"; }
trap cleanup EXIT

sh "$PGBIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
sh "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
PSQL="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -X"

$PSQL -d postgres -c "create database amongher" >/dev/null
P="$PSQL -d amongher"
$P -f "$HERE/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "• applying $(basename "$f")"; $P -f "$f"; done
echo "• seeding"; $P -f "$ROOT/supabase/seed.sql"; $P -f "$ROOT/supabase/seed.sql"   # twice: must be idempotent
echo "• running RLS tests"
$P -f "$HERE/rls_test.sql" | grep -vE "^$|^[0-9a-f-]{36}$"
