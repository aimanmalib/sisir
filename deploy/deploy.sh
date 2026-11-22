#!/usr/bin/env bash
# Deploy the Sisir playground as one static container behind the host's reverse proxy.
#   deploy/deploy.sh             build HEAD from a clean `git archive`, run it, install the route, verify
#   deploy/deploy.sh --rollback  run the previous image again (held by the stopped `sisir-undo` container)
#   deploy/deploy.sh --status    container, tags, rollback image and the public health code
#
# Host values live in deploy/hos.env (not tracked; deploy/hos.env.example lists them). The site has no secrets.
set -euo pipefail
cd "$(dirname "$0")"
[ -r hos.env ] || { echo "deploy/hos.env missing (copy deploy/hos.env.example)"; exit 1; }
# shellcheck disable=SC1091
. ./hos.env
: "${SISIR_DOMAIN:?}" "${SISIR_NETWORK:?}" "${PROXY_CONTAINER:?}" "${PROXY_DYNAMIC_DIR:?}" "${CERT_RESOLVER:?}"
BUILD_CMD=${BUILD_CMD:-docker build}
MIN_FREE_GB=${MIN_FREE_GB:-20}
export SISIR_NETWORK
DC="docker compose -f compose.yaml"
URL="https://$SISIR_DOMAIN"
HOLDER=sisir-undo

# Certificates use the HTTP-01 challenge: a name that does not resolve fails it and burns the CA's retry budget.
dns_ok() { getent ahosts "$SISIR_DOMAIN" >/dev/null; }

health_code() { curl -s -m 20 -o /dev/null -w '%{http_code}' "$URL/healthz" || true; }

# The page must reach visitors compressed and marked no-transform (the CDN then leaves it alone).
html_headers_ok() {
  local h
  h=$(curl -s -m 20 -o /dev/null -D - -H 'accept-encoding: br, gzip' "$URL/" | tr -d '\r' | tr 'A-Z' 'a-z') || return 1
  grep -E '^cache-control:.*no-transform' <<<"$h" >/dev/null && grep -E '^content-encoding: *(br|gzip)' <<<"$h" >/dev/null
}

hold_previous() {  # $1 = image ID the replaced container ran: keep it by ID in a stopped container
  local prev id=${1:-}
  prev=$(cat PREVIOUS_TAG 2>/dev/null) || { echo "note: first deploy, no rollback image yet"; return 0; }
  [ -n "$id" ] || id=$(docker image inspect -f '{{.Id}}' "sisir:$prev" 2>/dev/null) || id=""
  [ -n "$id" ] || { echo "WARNING: rollback image sisir:$prev not found; --rollback will fail" >&2; return 1; }
  docker rm -f "$HOLDER" >/dev/null 2>&1 || true
  docker tag "$id" "sisir:$prev"
  docker create --name "$HOLDER" --network none --restart no --label "sisir.tag=$prev" "sisir:$prev" >/dev/null
  echo "rollback image held: sisir:$prev (${id:7:12})"
}

case "${1:-}" in
  --status)
    $DC ps
    echo "current $(cat CURRENT_TAG 2>/dev/null || echo -) · previous $(cat PREVIOUS_TAG 2>/dev/null || echo -)"
    docker inspect -f 'rollback holder: {{index .Config.Labels "sisir.tag"}}' "$HOLDER" 2>/dev/null || echo "rollback holder: none"
    echo "public /healthz $(health_code)"; exit 0 ;;
  --rollback)
    dns_ok || { echo "$SISIR_DOMAIN does not resolve, nothing was changed"; exit 1; }
    TAG=$(cat PREVIOUS_TAG 2>/dev/null) || { echo "no PREVIOUS_TAG"; exit 1; }
    if ! docker image inspect "sisir:$TAG" >/dev/null 2>&1; then
      id=$(docker inspect -f '{{.Image}}' "$HOLDER" 2>/dev/null) || { echo "image sisir:$TAG is gone"; exit 1; }
      docker tag "$id" "sisir:$TAG"
    fi
    [ -r CURRENT_TAG ] && cp CURRENT_TAG PREVIOUS_TAG ;;
  "")
    dns_ok || { echo "$SISIR_DOMAIN does not resolve: create the DNS record first, nothing was changed"; exit 1; }
    [ -z "$(git -C .. status --porcelain)" ] || { echo "working tree not clean: commit first (the image is built from HEAD)"; exit 1; }
    free=$(df -BG --output=avail / | tail -1 | tr -dc 0-9)
    [ "$free" -ge "$MIN_FREE_GB" ] || { echo "less than ${MIN_FREE_GB} GB free on /, stopping"; exit 1; }
    TAG=$(git -C .. rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M)
    ctx=$(mktemp -d); trap 'rm -rf "$ctx"' EXIT
    git -C .. archive HEAD | tar -x -C "$ctx"   # clean tree: untracked and ignored files never reach the image
    $BUILD_CMD -t "sisir:$TAG" "$ctx"
    [ -r CURRENT_TAG ] && cp CURRENT_TAG PREVIOUS_TAG ;;
  *) echo "usage: deploy.sh [--rollback|--status]"; exit 2 ;;
esac

old_id=$(docker inspect -f '{{.Image}}' sisir 2>/dev/null || true)

SISIR_TAG=$TAG $DC up -d --force-recreate sisir
echo "$TAG" > CURRENT_TAG

route=$(mktemp)
sed -e "s|@DOMAIN@|$SISIR_DOMAIN|g" -e "s|@CERT_RESOLVER@|$CERT_RESOLVER|g" traefik.yaml.tmpl > "$route"
docker cp "$route" "$PROXY_CONTAINER:$PROXY_DYNAMIC_DIR/sisir.yaml"; rm -f "$route"

for _ in $(seq 30); do [ "$(docker inspect -f '{{.State.Health.Status}}' sisir)" = healthy ] && break; sleep 3; done
no_rollback=0; hold_previous "$old_id" || no_rollback=1

# Keep only the current and previous images of this project; the host disk is shared with other projects.
docker images sisir --format '{{.Tag}}' | grep -vxF -e "$TAG" -e "$(cat PREVIOUS_TAG 2>/dev/null || echo -)" \
  | sed 's/^/sisir:/' | xargs -r docker rmi >/dev/null 2>&1 || true

# A new route or certificate can take a little while: wait and retry before calling it a failure.
code=000; headers=no
for _ in $(seq 6); do
  code=$(health_code)
  if [ "$code" = 200 ] && html_headers_ok; then headers=yes; break; fi
  sleep 10
done
echo "tag $TAG · public /healthz $code · html no-transform + compressed: $headers"
[ "$code" = 200 ] || { echo "public health is not 200 yet: check the certificate and route; undo with deploy/deploy.sh --rollback"; exit 1; }
[ "$headers" = yes ] || { echo "the page is up but not compressed or not marked no-transform: check the route middleware"; exit 1; }
[ "$no_rollback" = 0 ] || { echo "live, but no rollback image is held (warning above)"; exit 1; }
