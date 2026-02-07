#!/bin/sh
set -e
# Start the context server in the background (embedded in this image)
/usr/local/bin/truthlayer-server &
# Wait for server to be ready
for i in 1 2 3 4 5 6 7 8 9 10; do
  if wget -q -O /dev/null http://127.0.0.1:3080/health 2>/dev/null; then break; fi
  if [ "$i" -eq 10 ]; then echo "Context server did not start"; exit 1; fi
  sleep 1
done
exec node dist/playground/server.js
