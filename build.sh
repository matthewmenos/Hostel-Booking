#!/usr/bin/env bash
set -e

# 1. Install frontend dependencies and build the React app.
cd frontend
npm ci
npm run build
cd ..

# 2. Install Python dependencies.
pip install -r backend/requirements.txt

cd backend

# 3. Restore global DB from R2 before migrate, so existing data is preserved.
#    Without this, Render's ephemeral filesystem gives a blank DB on every deploy.
python manage.py restore_global_db

# 4. Apply any pending migrations.
#    migrate writes to the DB (migration records), so it must run AFTER restore.
python manage.py migrate --noinput

# 5. Create/verify the superadmin account.
python manage.py ensure_superadmin

# 6. Upload the global DB back to R2 now that migrate + ensure_superadmin have
#    written to it. Without this step the next deploy restores a DB that is
#    missing the migration-record rows written in step 4, causing migrate to
#    re-run applied migrations against stale data.
python manage.py backup_global_db

# 7. Collect static files.
python manage.py collectstatic --noinput
