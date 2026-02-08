#!/bin/sh
set -e
log() { echo "[entrypoint] $*" 1>&2; }

# Start the context server in the background (embedded in this image)
log "Starting context server..."
/usr/local/bin/truthlayer-server &
# Wait for server to be ready
log "Waiting for context server health..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if wget -q -O /dev/null http://127.0.0.1:3080/health 2>/dev/null; then
    log "Context server ready."
    break
  fi
  if [ "$i" -eq 10 ]; then
    log "Context server did not start within 10s"
    sleep 15
    exit 1
  fi
  sleep 1
done

log "Starting Node server..."
node dist/playground/server.js
ec=$?
log "Node exited with code $ec"
sleep 10
exit $ec
