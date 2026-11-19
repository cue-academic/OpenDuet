#!/usr/bin/env sh
set -eu

if [ "$#" -ne 0 ]; then
  echo 'Usage: ./generate-secrets.sh (prints new values; does not edit .env)' >&2
  exit 2
fi

command -v openssl >/dev/null 2>&1 || {
  echo 'openssl is required.' >&2
  exit 1
}

printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)"
printf 'KEY_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)"
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -hex 32)"
printf 'WORKER_SHARED_SECRET=%s\n' "$(openssl rand -hex 32)"
