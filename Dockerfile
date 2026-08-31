# DrainLens on Cloud Run: nginx serving fourteen static files — eleven artefacts,
# index.html and two hashed bundles.
#
# There is no application server. The map, the terrain, the drainage network
# and the address index are build products, and the scenario engine runs in
# the browser. This container exists because Cloud Run gives a root URL with
# HTTPS and no domain, which the app needs — every path it fetches is absolute
# from `/`, so it cannot be served from a sub-path.
#
# Built in two stages so the published image carries no toolchain: the builder
# has Node and the whole repository, the runtime has nginx and `dist`.
#
# **This file lives at the repository root and must stay there.** `gcloud run
# deploy --source=.` looks for `./Dockerfile` and nothing else; with it under
# `deploy/` the first deployment silently fell back to Buildpacks and built
# something other than this — which would have shipped none of the content
# types, gzip settings or cache policy verified below.

FROM node:22-alpine AS build
WORKDIR /repo

# The lockfile first, so a dependency change is the only thing that busts the
# layer cache. `npm ci`, never `npm install` — it installs exactly what the
# lockfile says and fails if it and package.json have drifted, which is the
# defect this step exists to catch.
COPY package.json package-lock.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/scenario/package.json packages/scenario/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .
RUN npm run build --workspace @drainlens/web

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

# Cloud Run sends traffic to $PORT and does not promise it is 8080. nginx has
# no variable expansion in `listen`, so the port is substituted at start-up
# rather than baked in — a container that ignores $PORT is one Cloud Run marks
# unhealthy for reasons the logs do not explain.
ENV PORT=8080
CMD ["/bin/sh", "-c", "sed -i \"s/listen 8080/listen ${PORT}/\" /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
