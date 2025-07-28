#!/bin/sh
set -e

echo "Starting TEA Backend..."

# First, ensure database tables have correct names
echo "Ensuring database tables have correct names..."
python manage.py ensure_correct_table_names || {
    echo "Warning: Could not check/fix table names. Continuing..."
}

# Then fix any known migration issues
echo "Checking for migration history issues..."
python manage.py fix_migration_history || true

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput || {
    echo "Migration failed. Checking migration state..."
    python manage.py showmigrations
    echo "Attempting to fix and retry..."
    python manage.py migrate --fake-initial --noinput || {
        echo "Migration still failing. Starting without migrations."
    }
}

# Create superuser if environment variables are set
echo "Checking for superuser creation..."
python manage.py createadmin || echo "Skipping superuser creation"

# Start the application
echo "Starting Daphne server..."
exec daphne -b 0.0.0.0 -p 8000 tea_backend.asgi:application
