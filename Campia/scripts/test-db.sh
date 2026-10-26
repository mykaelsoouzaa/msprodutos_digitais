#!/usr/bin/env bash
# Roda a migração e os testes de permissão num Postgres local descartável.
# Requer os binários do PostgreSQL (initdb, pg_ctl, psql) no PATH ou em /usr/lib/postgresql/*/bin.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DIR="$(mktemp -d)"
trap '"$PGBIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"$PGBIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
"$PGBIN/pg_ctl" -D "$DIR/data" -o "-p 55432 -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
sleep 2
ARGS=(-f "$ROOT/supabase/tests/00_supabase_stub.sql")
for f in "$ROOT"/supabase/migrations/*.sql; do ARGS+=(-f "$f"); done
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do ARGS+=(-f "$f"); done
psql -h "$DIR" -p 55432 -U postgres -v ON_ERROR_STOP=1 -q "${ARGS[@]}" | grep -E "PASSARAM"
