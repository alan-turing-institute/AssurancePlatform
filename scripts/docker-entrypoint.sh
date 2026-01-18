#!/bin/sh
set -e

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy
echo "Migrations applied successfully."

echo "Starting Next.js server..."
exec node server.js
