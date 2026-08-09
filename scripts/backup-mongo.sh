#!/bin/bash
set -e
TIMESTAMP=$(date +"%F")
BACKUP_DIR="/app/backups/$TIMESTAMP"
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR"
# Upload to S3 logic here
