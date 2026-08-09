#!/bin/bash
set -e
BACKUP_DIR=$1
if [ -z "$BACKUP_DIR" ]; then echo "Missing backup directory"; exit 1; fi
mongorestore --uri="$MONGO_URI" --drop "$BACKUP_DIR"
