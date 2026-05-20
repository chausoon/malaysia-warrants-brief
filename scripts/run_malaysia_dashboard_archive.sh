#!/bin/bash
set -euo pipefail

PROJECT_DIR="/Users/chausoon/Documents/New project"
LOG_DIR="$PROJECT_DIR/outputs/auto-archives/logs"
STATUS_DIR="$PROJECT_DIR/outputs/auto-archives/status"
NODE_BIN="/opt/homebrew/bin/node"

mkdir -p "$LOG_DIR"
mkdir -p "$STATUS_DIR"
cd "$PROJECT_DIR"

RUN_AT="$(date '+%Y-%m-%d %H:%M:%S %Z')"

if "$NODE_BIN" scripts/archive_malaysia_dashboard.mjs >> "$LOG_DIR/archive-run.log" 2>&1; then
  printf "%s\n" "$RUN_AT" > "$STATUS_DIR/last-success.txt"
  rm -f "$STATUS_DIR/last-failure.txt"
  exit 0
fi

EXIT_CODE=$?
FAIL_MSG="Malaysia dashboard archive failed at $RUN_AT (exit $EXIT_CODE). Check $LOG_DIR/archive-run.log"
printf "%s\n" "$FAIL_MSG" > "$STATUS_DIR/last-failure.txt"
/usr/bin/osascript -e "display notification \"Check archive-run.log for details.\" with title \"Malaysia Dashboard archive failed\" subtitle \"$RUN_AT\"" >/dev/null 2>&1 || true
exit "$EXIT_CODE"
