#!/bin/sh
set -eu
export LC_ALL=C

normalize_url() {
    name=$1
    value=$2
    if [ -z "$value" ]; then return; fi
    # Reject controls before matching a single URL; grep alone matches lines.
    case "$value" in
        *[![:print:]]*) echo "$name must be a single HTTP(S) server URL." >&2; exit 1 ;;
    esac
    if ! printf '%s' "$value" | grep -Eq "^https?://(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9_.-]+)(:[0-9]+)?(/[a-zA-Z0-9._~!\$&'()*+,;=:@%/-]*)?$"; then
        echo "$name must be an HTTP(S) URL without credentials, a query or a fragment." >&2
        exit 1
    fi
    printf '%s' "$value" | sed 's:/*$::'
}

JELLYFIN_URL=$(normalize_url JELLYFIN_URL "${JELLYFIN_URL:-}")
SEERR_URL=$(normalize_url SEERR_URL "${SEERR_URL:-}")

mkdir -p /tmp/p-fin
# URL validation excludes JSON quotes, backslashes and control characters.
printf '{"jellyfinUrl":"%s","seerrUrl":"%s"}\n' "$JELLYFIN_URL" "$SEERR_URL" > /tmp/p-fin/server-config.json

# Encode literal dollar signs in URL paths so Nginx cannot treat them as variables.
PFIN_JELLYFIN_URL=$(printf '%s' "$JELLYFIN_URL" | sed 's/\$/%24/g')
PFIN_SEERR_URL=$(printf '%s' "$SEERR_URL" | sed 's/\$/%24/g')
# Docker's embedded resolver knows container service names; public DNS does not.
PFIN_DNS_RESOLVERS=$(awk '$1 == "nameserver" { if (index($2, ":")) printf "[%s] ", $2; else printf "%s ", $2 }' /etc/resolv.conf)
if [ -z "$PFIN_DNS_RESOLVERS" ]; then
    echo "No DNS resolver was provided to this container." >&2
    exit 1
fi
export PFIN_JELLYFIN_URL PFIN_SEERR_URL PFIN_DNS_RESOLVERS
envsubst '${PFIN_JELLYFIN_URL} ${PFIN_SEERR_URL} ${PFIN_DNS_RESOLVERS}' \
    < /etc/nginx/templates/p-fin.conf.template > /tmp/p-fin/nginx.conf

exec "$@"
