#!/usr/bin/env bash
set -e

# 1. Install frontend dependencies and build the React app.
cd frontend
npm ci
npm run build
cd ..

# 2. Install Python dependencies.
pip install -r backend/requirements.txt

# 3. Collect Django static files (whitenoise needs them in staticfiles/).
cd backend
python manage.py collectstatic --noinput
python manage.py migrate --noinput
