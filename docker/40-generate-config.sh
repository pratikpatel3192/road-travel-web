#!/bin/sh
# Write the runtime config.json the SPA fetches at startup, from Cloud Run env vars.
# One image, any environment (ADR-0024). All values here are PUBLISHABLE (client-side) keys.
set -e
cat > /usr/share/nginx/html/config.json <<JSON
{
  "apiBaseUrl": "${CONFIG_API_BASE_URL:-https://api.roadtravel.info}",
  "supabaseUrl": "${CONFIG_SUPABASE_URL:-}",
  "supabaseAnonKey": "${CONFIG_SUPABASE_ANON_KEY:-}",
  "mapboxToken": "${CONFIG_MAPBOX_TOKEN:-}",
  "revenueCatWebApiKey": "${CONFIG_REVENUECAT_WEB_API_KEY:-}",
  "revenueCatOfferingId": "${CONFIG_REVENUECAT_OFFERING_ID:-}"
}
JSON
echo "[config] wrote /config.json (apiBaseUrl=${CONFIG_API_BASE_URL:-https://api.roadtravel.info}, supabase=${CONFIG_SUPABASE_URL:+set}, mapbox=${CONFIG_MAPBOX_TOKEN:+set})"
