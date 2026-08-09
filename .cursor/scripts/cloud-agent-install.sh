#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

npm ci

# Materialize .env from Cloud Agent secrets when present.
if [[ -n "${VITE_SUPABASE_URL:-}" && -n "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  umask 077
  {
    printf 'VITE_SUPABASE_URL=%s\n' "$VITE_SUPABASE_URL"
    printf 'VITE_SUPABASE_ANON_KEY=%s\n' "$VITE_SUPABASE_ANON_KEY"
    if [[ -n "${VITE_ADMIN_PROMO_KEY:-}" ]]; then
      printf 'VITE_ADMIN_PROMO_KEY=%s\n' "$VITE_ADMIN_PROMO_KEY"
    fi
  } > .env
fi
