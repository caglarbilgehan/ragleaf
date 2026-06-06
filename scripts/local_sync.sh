#!/bin/bash
# Local real-time file synchronization script using inotifywait and rsync
# Nirvana -> cserver-2 (Legion)

# Directories
LOCAL_DIR="/mnt/c/Users/Casper/Documents/MEGA/Servers-Cloud/ragleaf"
REMOTE_HOST="cserver-2"
REMOTE_DIR="/home/cserver/ragleaf"

# Exclusions
EXCLUDE_ARGS=(
    --exclude 'node_modules'
    --exclude '.git'
    --exclude '.next'
    --exclude 'dist'
    --exclude 'storage'
    --exclude 'logs'
    --exclude '.env'
    --exclude 'scripts/local_sync.sh'
    --exclude '.idea'
    --exclude '.vscode'
)

echo "==========================================================="
echo "   Ragleaf Local -> Remote Sync (Nirvana -> cserver-2)   "
echo "==========================================================="

# Perform initial synchronization
echo "Performing initial sync..."
rsync -avz "${EXCLUDE_ARGS[@]}" "$LOCAL_DIR/" "$REMOTE_HOST:$REMOTE_DIR/"
echo "Initial sync completed."

echo "Watching $LOCAL_DIR for changes..."
echo "Press Ctrl+C to stop the sync session."

# Watch for changes and sync
inotifywait -m -r -e modify,create,delete,move --format '%w%f' "$LOCAL_DIR" | while read -r FILE
do
    # Ignore changes in excluded directories
    if [[ "$FILE" =~ /(node_modules|\.git|\.next|storage|logs)/ ]]; then
        continue
    fi
    
    echo "Change detected: $FILE"
    rsync -avz "${EXCLUDE_ARGS[@]}" "$LOCAL_DIR/" "$REMOTE_HOST:$REMOTE_DIR/"
done
