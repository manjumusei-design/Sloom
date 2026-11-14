#!/usr/bin/env bash
set -euo pipefail

read_secret() {
  local service="$1" prefix="$2" label="$3"
  local value
  if ! value="$(security find-generic-password -s "$service" -w 2>/dev/null)"; then
    echo "MISSING: no Keychain entry for service '$service' ($label)." >&2
    echo "  Store it with: security add-generic-password -U -s $service -w" >&2
    exit 1
  fi
  case "$value" in
    "$prefix"*) ;;
    *) echo "INVALID: Keychain entry '$service' does not start with '$prefix'." >&2; exit 1 ;;
  esac
  printf '%s' "$value"
}

SLACK_APP_TOKEN="$(read_secret sloom-slack-app-token 'xapp-' 'app-level token, connections:write')"
export SLACK_APP_TOKEN
SLACK_BOT_TOKEN="$(read_secret sloom-slack-bot-token 'xoxb-' 'bot user token, from app install')"
export SLACK_BOT_TOKEN

echo "[dev] app token: present (xapp-, ${#SLACK_APP_TOKEN} chars)"
echo "[dev] bot token: present (xoxb-, ${#SLACK_BOT_TOKEN} chars)"
echo "[dev] starting bot (Socket Mode)"

exec npx tsx watch src/index.ts
