# 0007. The playground is served by one static nginx container behind the host's reverse proxy

- Status: accepted
- Date: 2026-11-22

## Context

The playground is a static Vite build. It reads the EVM RPC directly (that endpoint sends CORS headers) and needs
no server code and no proxy. It has to stay reachable at `https://sisir.sasateguh.com` until at least 22 December
2026. A CDN sits in front: without `Cache-Control: no-transform` it may rewrite the HTML and add its own scripts,
and with `no-transform` it no longer compresses the page.

## Decision

- `Dockerfile` has two stages. Stage 1 (`node:22.23.4-alpine`) installs the root packages the shared rule engine
  imports, installs `web/`, and runs the web build. Stage 2 (`nginx:1.30.7-alpine`) carries only `web/dist` and our
  own `deploy/nginx/nginx.conf`. The container runs as the `nginx` user on port 8080, read-only, with `/tmp` as
  tmpfs, a quarter CPU and 64 MB of memory.
- Cache headers by file type: HTML `no-cache, no-transform`; files under `/assets/` (Vite puts a content hash in
  each name) `public, max-age=31536000, immutable`, set only on success so a 404 is never cached for a year;
  `/healthz` `no-store`. nginx compresses, and the proxy route adds a `compress` middleware as well.
- `deploy/deploy.sh` builds from a clean `git archive` of HEAD (ignored files never reach the image), refuses a
  dirty tree, a name that does not resolve, or less than 20 GB free disk, installs the proxy route from
  `deploy/traefik.yaml.tmpl`, and checks `/healthz` and the HTML headers through the public URL, retrying for a
  minute before it reports a failure. The previous image is held by a stopped `sisir-undo` container.
- Host values (domain, proxy container, network, build command, alert command) live in `deploy/hos.env`, which is
  not tracked; `deploy/hos.env.example` lists them.
- `deploy/uptime.sh` runs every 15 minutes from cron until 22 December 2026: two failures in a row send one
  warning, the first success after that sends one recovery line.

## How to undo

- A bad release: `bash deploy/deploy.sh --rollback` runs the previous image again (running it twice returns to the
  newer one).
- Taking the site down: `docker rm -f sisir sisir-undo`, delete `sisir.yaml` from the proxy's dynamic folder, and
  remove the cron line. Nothing else on the host depends on it.
