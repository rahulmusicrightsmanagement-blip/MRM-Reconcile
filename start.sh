#!/usr/bin/env bash
# Start the MRM reconciliation app: builds the React frontend and serves everything from Django.
set -e
cd "$(dirname "$0")"
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install -q -r backend/requirements.txt; }
(cd frontend && { [ -d node_modules ] || npm install; } && npm run build)
cd backend
../.venv/bin/python manage.py migrate -v 0
echo "MRM app running at http://127.0.0.1:8010"
exec ../.venv/bin/python manage.py runserver 127.0.0.1:8010
