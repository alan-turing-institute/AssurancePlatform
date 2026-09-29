#!/usr/bin/env bash
# serve-production-build.sh — build and serve a production TEA instance on a
# throwaway database, for browser-based verification of a change.
#
#   serve-production-build.sh up <port>    build, seed a fresh database, start
#   serve-production-build.sh down <port>  stop the server and drop its database
#
# Everything this script creates is disposable and local:
#   - the database lives on the `postgres-test` container (port 5433,
#     docker-compose.local.yml). It is created fresh on every `up`, named
#     "serve_<port>_<epoch>", and `down` drops only that name — never
#     anything without the "serve_" prefix. The dev database on 5432 is
#     never touched, and `prisma migrate reset` is never run.
#   - the server binds to localhost:<port> with a throwaway NEXTAUTH_SECRET.
#   - `down` kills only the PID recorded by `up` (the standalone server
#     process renames itself, so pkill by name would miss it or hit the
#     wrong one).
#
# State (the recorded PID and database name) and logs live under .tmp/ in
# this checkout, not /tmp, so they belong to it and are already gitignored.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$REPO_ROOT/.tmp/serve-production-build"
DB_PREFIX="serve_"
ADMIN_URL="postgresql://tea_user:tea_password@localhost:5433/tea_test_admin"

usage() { echo "usage: $0 up|down <port>" >&2; exit 2; }
[[ $# -eq 2 ]] || usage
action=$1; port=$2
[[ "$port" =~ ^[0-9]+$ ]] || { echo "refusing: port must be numeric" >&2; exit 2; }

state_file="$STATE_DIR/${port}.state"
mkdir -p "$STATE_DIR"

if [[ "$action" == "down" ]]; then
	if [[ ! -f "$state_file" ]]; then
		echo "no state for :$port — nothing started by this script is running"
		exit 0
	fi
	# Read only the two keys we expect, one line at a time — never source the
	# file. A tampered state file (e.g. a shell command tacked onto DB=) is
	# just a string here until it passes the format checks below.
	read_state_value() {
		grep -m1 -E "^${1}=" "$state_file" | cut -d= -f2-
	}
	pid="$(read_state_value PID)"
	db="$(read_state_value DB)"
	if [[ -n "$pid" && ! "$pid" =~ ^[0-9]+$ ]]; then
		echo "refusing: state file has an invalid pid '$pid'" >&2
		exit 1
	fi
	if [[ -n "$db" && ! "$db" =~ ^serve_[0-9]+_[0-9]+$ ]]; then
		echo "refusing: state file has an invalid database name '$db' — does not match '${DB_PREFIX}<port>_<epoch>'" >&2
		exit 1
	fi
	if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
		cmdline=""
		if [[ -r "/proc/$pid/cmdline" ]]; then
			cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
		fi
		if [[ "$cmdline" == *server.js* || "$cmdline" == *next-server* ]]; then
			kill "$pid"; sleep 1; kill -0 "$pid" 2>/dev/null && kill -9 "$pid" || true
			echo "stopped pid $pid on :$port"
		else
			echo "pid $pid was reused by another process (cmdline does not match) — not killing it"
		fi
	else
		echo "no live process for :$port (already stopped)"
	fi
	if [[ -n "$db" ]]; then
		docker exec tea_postgres_test psql -U tea_user -d tea_test_admin -c "DROP DATABASE IF EXISTS ${db}" >/dev/null
		echo "dropped database $db"
	fi
	rm -f "$state_file"
	exit 0
fi
[[ "$action" == "up" ]] || usage

if [[ -f "$state_file" ]]; then
	echo "refusing: $state_file already exists — run '$0 down $port' first" >&2
	exit 2
fi
if ss -ltn | awk '{print $4}' | grep -q ":${port}$"; then
	echo "refusing: :$port is already in use" >&2
	exit 2
fi
if ! docker exec tea_postgres_test pg_isready -U tea_user -d tea_test_admin -q; then
	echo "refusing: postgres-test is not reachable — start it with:" >&2
	echo "  docker compose -f docker-compose.local.yml up -d postgres-test" >&2
	exit 2
fi

db="${DB_PREFIX}${port}_$(date +%s)"
db_url="postgresql://tea_user:tea_password@localhost:5433/${db}"
secret="throwaway-verify-secret-${port}-not-for-production"
log_dir="$STATE_DIR"
build_log="$log_dir/${port}.build.log"
migrate_log="$log_dir/${port}.migrate.log"
seed_log="$log_dir/${port}.seed.log"
server_log="$log_dir/${port}.server.log"

seed_password="${SEED_USER_PASSWORD:-}"
if [[ -z "$seed_password" ]]; then
	# Must satisfy lib/schemas/user.ts's passwordSchema: >=8 chars, an
	# uppercase letter, a digit, a special character. The random part alone
	# (lowercase hex) never guarantees that, so a fixed suffix does.
	seed_password="$(openssl rand -hex 12)Aa1!"
fi

echo "== 1/6 generate prisma client (placeholder DATABASE_URL, so a fresh checkout builds)"
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
	pnpm --dir "$REPO_ROOT" exec prisma generate >"$build_log" 2>&1 \
	|| { tail -30 "$build_log" >&2; exit 1; }

echo "== 2/6 production build"
# page-data collection needs a reachable database; the admin DB on the test container will do
DATABASE_URL="$ADMIN_URL" pnpm --dir "$REPO_ROOT" build >>"$build_log" 2>&1 \
	|| { tail -30 "$build_log" >&2; exit 1; }
# next build rewrites these two tracked files; put them back so the checkout stays clean
git -C "$REPO_ROOT" checkout -- tsconfig.json next-env.d.ts 2>/dev/null || true

echo "== 3/6 static assets beside the standalone server"
mkdir -p "$REPO_ROOT/.next/standalone/.next"
rm -rf "$REPO_ROOT/.next/standalone/.next/static" "$REPO_ROOT/.next/standalone/public"
cp -r "$REPO_ROOT/.next/static" "$REPO_ROOT/.next/standalone/.next/static"
cp -r "$REPO_ROOT/public" "$REPO_ROOT/.next/standalone/public"

echo "== 4/6 fresh database $db on postgres-test (5433)"
docker exec tea_postgres_test psql -U tea_user -d tea_test_admin -c "CREATE DATABASE ${db}" >/dev/null
# record state as soon as the database exists, so a failure from here on still leaves `down` able to clean up
cat >"$state_file" <<EOF
DB=$db
PORT=$port
EOF
DATABASE_URL="$db_url" pnpm --dir "$REPO_ROOT" exec prisma migrate deploy >"$migrate_log" 2>&1 \
	|| { tail -20 "$migrate_log" >&2; exit 1; }

echo "== 5/6 seed"
DATABASE_URL="$db_url" SEED_USER_PASSWORD="$seed_password" \
	pnpm --dir "$REPO_ROOT" exec tsx prisma/seed/dev-seed.ts >"$seed_log" 2>&1 \
	|| { tail -20 "$seed_log" >&2; exit 1; }

echo "== 6/6 start standalone server on :$port"
# USE_LOCAL_STORAGE: a production build has no Azure Blob settings here, so without it every upload
# route returns "storage not configured". Files land under <standalone>/uploads (UPLOADS_DIR's
# default, <cwd>/uploads — Next's generated standalone server.js chdir()s to its own folder on
# startup, so that's where this server's process.cwd() resolves to), which is disposable with
# everything else this script creates.
DATABASE_URL="$db_url" NEXTAUTH_SECRET="$secret" NEXTAUTH_URL="http://localhost:${port}" PORT="$port" HOSTNAME=127.0.0.1 \
	USE_LOCAL_STORAGE=true nohup node "$REPO_ROOT/.next/standalone/server.js" >"$server_log" 2>&1 &
pid=$!
cat >"$state_file" <<EOF
PID=$pid
DB=$db
PORT=$port
EOF
for _ in $(seq 1 60); do curl -sf -o /dev/null "http://localhost:${port}/" && break; sleep 1; done
# on disk: <standalone>/.next/static/chunks/x.js  → served at: /_next/static/chunks/x.js
# `-print -quit` stops find after the first match itself, rather than piping into
# `head -1`: with many chunks, `head` closes the pipe as soon as it has its one line,
# and `find` can be killed by SIGPIPE trying to write the next match — which, under
# `pipefail`, aborted this script (silently, right here) under load.
chunk_file=$(find "$REPO_ROOT/.next/standalone/.next/static/chunks" -name '*.js' -print -quit)
chunk="/_next${chunk_file#"$REPO_ROOT"/.next/standalone/.next}"
code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}${chunk}")
[[ "$code" == "200" ]] || { echo "static chunk $chunk returned $code — client bundle is NOT being served; do not trust any render" >&2; exit 1; }

echo "READY url=http://localhost:${port} db=${db} commit=$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
echo "seed password (local-only, this database is throwaway): $seed_password"
