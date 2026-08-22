#!/usr/bin/env bash
#
# Deploy the agent service, taking every secret from .env.prod at deploy
# time rather than from template.yml.
#
# template.yml used to carry all of these hardcoded inline, which is why
# it had to be gitignored -- which in turn meant the entire
# infrastructure definition existed only on one laptop.
#
# Usage:  ./deploy.sh
#         ENV_FILE=.env.staging ./deploy.sh

set -euo pipefail
cd "$(dirname "$0")"

# Deliberately NOT .env. The local .env holds dev values (test Razorpay
# key, localhost URLs); deploying those to prod would quietly break
# payments.
ENV_FILE="${ENV_FILE:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found." >&2
  echo "Prod secrets are not in git by design. Recreate it from your" >&2
  echo "password manager or the CloudFormation stack." >&2
  exit 1
fi

PARAMS=(
  GROQ_API_KEY
  GROQ_CLASSIFIER_API_KEY
  GROQ_PLANNER_API_KEY
  OPENTRIPMAP_API_KEY
  DUFFEL_API_TOKEN
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  NVIDIA_API_KEY
  RAZORPAY_KEY_ID
  RAZORPAY_KEY_SECRET
  RAZORPAY_WEBHOOK_SECRET
  SUPABASE_URL
  SUPABASE_SECRET_KEY
  CLERK_SECRET_KEY
  CLERK_PUBLISHABLE_KEY
  CLERK_AUTHORIZED_PARTIES
  HF_TOKEN
)

# Read the env file without executing it, tolerating CRLF line endings
# (this repo has a mix, and a stray \r silently corrupts a secret).
declare -A VALUES
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" != *=* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  key="$(echo -n "$key" | tr -d '[:space:]')"
  val="${val%\"}"; val="${val#\"}"
  VALUES["$key"]="$val"
done < "$ENV_FILE"

OVERRIDES=()
MISSING=()
for key in "${PARAMS[@]}"; do
  val="${VALUES[$key]:-}"
  if [[ -z "$val" ]]; then MISSING+=("$key"); else OVERRIDES+=("${key}=${val}"); fi
done

if (( ${#MISSING[@]} )); then
  echo "error: missing/empty in $ENV_FILE:" >&2
  printf '  - %s\n' "${MISSING[@]}" >&2
  exit 1
fi

# Guard against shipping a live payment key by accident.
if [[ "${VALUES[RAZORPAY_KEY_ID]}" == rzp_live_* ]]; then
  echo "WARNING: RAZORPAY_KEY_ID is a LIVE key -- this deploy takes real money." >&2
  read -r -p "Type 'live' to continue: " confirm
  [[ "$confirm" == "live" ]] || { echo "aborted."; exit 1; }
fi

echo "Building..."
sam build

echo "Deploying (${#OVERRIDES[@]} parameters from $ENV_FILE)..."
sam deploy --parameter-overrides "${OVERRIDES[@]}" "$@"
