#!/bin/sh
set -e

# ─── Ensure data directories exist and have correct ownership ───
# When Docker creates bind-mount directories, they default to root.
# This script fixes ownership to match the specified PUID:PGID
# and then drops privileges to run the app as that user.

TARGET_UID="${PUID:-1000}"
TARGET_GID="${PGID:-1000}"

# Ensure directories exist
mkdir -p /app/server/data /app/server/uploads

# Fix ownership
chown -R "$TARGET_UID:$TARGET_GID" /app/server/data
chown -R "$TARGET_UID:$TARGET_GID" /app/server/uploads

# Drop privileges and run the command as the target user
exec su-exec "$TARGET_UID:$TARGET_GID" "$@"
