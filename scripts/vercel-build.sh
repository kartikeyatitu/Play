#!/usr/bin/env bash
# Vercel build. Production builds are unchanged: prisma generate && next build.
# Preview builds can sync the STAGING database schema from prisma/schema.prisma, only when
# TRIQ_STAGING_DB=1 is set for the Preview environment and the URL is not the production project.
set -euo pipefail

PROD_REF="tfekmfumwsnxcddixlxm" # Supabase project "triq" (production). Never push schema here.

npx prisma generate

if [ "${VERCEL_ENV:-}" = "preview" ] && [ "${TRIQ_STAGING_DB:-}" = "1" ]; then
  case "${DATABASE_URL:-}${DIRECT_URL:-}" in
    *"$PROD_REF"*)
      echo "Refusing to push schema: the Preview database URL points at production ($PROD_REF)." >&2
      exit 1
      ;;
  esac
  echo "Preview build: syncing staging database schema from prisma/schema.prisma"
  # Staging holds fictional data only, so dropping obsolete columns is acceptable here.
  npx prisma db push --skip-generate --accept-data-loss
fi

npx next build
