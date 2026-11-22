# The public playground: a static site. deploy/deploy.sh builds it from a clean `git archive` of HEAD.
# Stage 1 builds web/ (it imports the rule engine from src/, config/app.json and the fixtures/ examples).
# Stage 2 is nginx serving the built files only: no Node, no source, no build tools at run time.
FROM node:22.23.4-alpine AS build
ENV CI=true
WORKDIR /app
# Root packages: the parser and hash library the shared rule engine imports. No build step is needed here.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci --no-audit --no-fund
COPY src ./src
COPY config ./config
COPY fixtures ./fixtures
COPY web ./web
RUN cd web && npm run build

FROM nginx:1.30.7-alpine
# Our own nginx.conf replaces the image default: unprivileged port, pid and temp files under /tmp
# (the container runs read-only with tmpfs mounts), cache headers per file type, /healthz.
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/nginx/headers.conf /etc/nginx/headers.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
# Skip the image's entrypoint scripts: they try to rewrite config files, which a read-only container cannot do.
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
