#!/bin/sh

set -e

echo "Setting up directories..."

# Setup the directories
mkdir -p /app/data/videos
mkdir -p /app/data/avatars

mkdir -p /app/uploads

# Now start the main application
exec "$@"