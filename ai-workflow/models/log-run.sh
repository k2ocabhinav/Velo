#!/usr/bin/env bash
# Append one rated run to runs.jsonl.
# Usage: log-run.sh <result.ndjson|-> <role> <model> <harness> <quality 0-5> <precision 0-1|-> "<notes>"
set -euo pipefail
[ $# -eq 7 ] || { echo "usage: $0 <ndjson|-> <role> <model> <harness> <quality> <precision> <notes>" >&2; exit 1; }
src=$1 role=$2 model=$3 harness=$4 quality=$5 precision=$6 notes=$7
log="$(cd "$(dirname "$0")" && pwd)/runs.jsonl"
if [ "$src" != "-" ] && [ -s "$src" ] && tail -1 "$src" | jq -e '.type=="result"' >/dev/null 2>&1; then
  result=$(tail -1 "$src" | jq -c '{status:.subtype, stop:.stopReason, in:.usage.inputTokens, out:.usage.outputTokens, cache_read:.usage.cacheReadTokens, minutes:((.durationMs/600|floor)/100)}')
else
  result='{"status":"no-result"}'
fi
jq -nc --arg date "$(date +%F)" --arg role "$role" --arg model "$model" --arg harness "$harness" \
  --argjson quality "$quality" --arg precision "$precision" --arg notes "$notes" --argjson r "$result" \
  '{date:$date, harness:$harness, role:$role, model:$model} + $r + {quality:$quality, precision:$precision, notes:$notes}' >> "$log"
tail -1 "$log"
