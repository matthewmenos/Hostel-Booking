#!/usr/bin/env bash
set -e

# 1. Install frontend dependencies and build the React app.
cd frontend
npm ci
npm run build
cd ..

# 2. Install Python dependencies.
pip install -r backend/requirements.txt

# 3. Restore global DB from R2 (if wiped by Render's ephemeral filesystem),
#    then apply any pending migrations, then collect static files.
cd backend
python manage.py restore_global_db
python manage.py migrate --noinput
python manage.py ensure_superadmin
python manage.py collectstatic --noinput
