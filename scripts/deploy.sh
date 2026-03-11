#!/bin/bash
# Build and deploy artnewsroom
set -e
cd "$(dirname "$0")/.."

echo "→ Building Next.js..."
npm run build

echo "→ Preparing standalone..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
ln -sfn "$(pwd)/data" .next/standalone/data

echo "→ Restarting service..."
systemctl --user restart artnewsroom.service

echo "→ Waiting for startup..."
sleep 2

if curl -sf http://localhost:3000/ > /dev/null; then
  echo "✓ Deployed successfully"
else
  echo "✗ Health check failed"
  systemctl --user status artnewsroom.service
  exit 1
fi
