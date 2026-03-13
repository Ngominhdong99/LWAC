#!/usr/bin/env bash
# Build script for Render backend deployment
set -o errexit

pip install -r requirements.txt

# Run database table creation (handled by SQLAlchemy on startup)
python -c "from app.models import Base; from app.database import engine; Base.metadata.create_all(bind=engine)"
