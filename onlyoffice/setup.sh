#!/bin/bash
# TenderBuild — OnlyOffice setup script
# Creates container with port mapping, patches private-IP filter, restarts services
set -e

CONTAINER="onlyoffice"
IMAGE="onlyoffice/documentserver:8.2"
HOST_PORT=8000

echo "1. Stopping old container..."
docker stop $CONTAINER 2>/dev/null || true
docker rm $CONTAINER 2>/dev/null || true

echo "2. Starting $IMAGE on port $HOST_PORT..."
docker run -d --name $CONTAINER -p $HOST_PORT:80 -e JWT_ENABLED=false $IMAGE

echo "3. Waiting for DocumentServer to initialize (~30s)..."
for i in $(seq 1 40); do
  if curl -sf http://localhost:$HOST_PORT/healthcheck >/dev/null 2>&1; then
    echo "   ✅ DocumentServer ready after ${i}s"
    break
  fi
  sleep 1
done

echo "4. Patching request-filtering-agent (allow private IPs)..."
docker exec $CONTAINER bash -c '
  CONF=/etc/onlyoffice/documentserver
  for f in $CONF/default.json $CONF/local.json; do
    if [ -f "$f" ]; then
      python3 -c "
import json
with open(\"$f\") as fh: d = json.load(fh)
d.setdefault(\"request-filtering-agent\", {}).update({\"allowPrivateIPAddress\": True, \"allowMetaIPAddress\": True})
with open(\"$f\", \"w\") as fh: json.dump(d, fh, indent=2)
" 2>/dev/null && echo "   Patched $f" || echo "   Skipped $f"
    fi
  done
'

echo "5. Restarting services..."
docker exec $CONTAINER supervisorctl restart all 2>/dev/null || true
sleep 3

echo "6. Verifying..."
STATUS=$(curl -sf http://localhost:$HOST_PORT/healthcheck 2>&1)
if [ "$STATUS" = "true" ]; then
  echo "   ✅ OnlyOffice DocumentServer running on http://localhost:$HOST_PORT"
else
  echo "   ⚠️  Healthcheck returned: $STATUS"
fi

echo "Done."
