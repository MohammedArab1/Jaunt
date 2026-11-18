#!/bin/sh
# Runs from /docker-entrypoint.d before nginx starts.
# Generates the browser runtime config and the nginx config from environment
# variables so the same image can run same-origin or against a separate API.
set -eu

api_base_url="${API_BASE_URL:-}"
api_upstream="${API_UPSTREAM:-http://api:3100}"

escape_json() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__JAUNT_CONFIG__ = { apiBaseUrl: "$(escape_json "$api_base_url")" };
EOF

connect_src="'self'"
case "$api_base_url" in
  http://*|https://*)
    connect_src="$connect_src $api_base_url"
    ;;
esac

export API_UPSTREAM="$api_upstream"
export CONNECT_SRC="$connect_src"

envsubst '${API_UPSTREAM} ${CONNECT_SRC}' \
  < /etc/nginx/jaunt/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf
