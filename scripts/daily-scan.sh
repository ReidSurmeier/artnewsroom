#!/usr/bin/env bash
set -euo pipefail

cd /home/reidsurmeier/artnewsroom

LOG_DIR="data/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily-scan-$(date +%Y-%m-%d).log"

echo "=== Daily scan started at $(date) ===" >> "$LOG_FILE"

/usr/bin/npx tsx src/scripts/daily-scan.ts >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

echo "=== Scan finished at $(date) with exit code $EXIT_CODE ===" >> "$LOG_FILE"

# Commit any new data
if [[ -n "$(git status --porcelain data/)" ]]; then
  git add data/
  git commit -m "daily-scan: $(date +%Y-%m-%d) — new candidates" --no-verify
  echo "=== Committed new data ===" >> "$LOG_FILE"
fi

# Prune logs older than 30 days
find "$LOG_DIR" -name "daily-scan-*.log" -mtime +30 -delete 2>/dev/null || true

exit $EXIT_CODE
