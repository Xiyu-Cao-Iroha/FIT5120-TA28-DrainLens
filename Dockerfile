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

# Where the built site looks for the database.
#
# Vite inlines this at build time, so it is a property of the image rather than
# of the running container -- there is no way to change it with `--set-env-vars`
# afterwards, and pretending otherwise would produce a deployment that silently
# kept reading files.
#
# **It defaults to the deployed API rather than to nothing**, because
# `gcloud run deploy --source=.` has no way to pass a build argument: whatever
# is written here is what ships. A checkout still defaults to the bundled files
# — `source.ts` reads an unset variable as "do not ask a server" — so `npm run
# dev` does not reach across the internet to a production database.
#
# To build a site that ignores the API entirely:
#   docker build --build-arg VITE_API_BASE= -t drainlens .
ARG VITE_API_BASE=https://drainlens-api-205559161217.australia-southeast1.run.app
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build --workspace @drainlens/web

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
# Strip carriage returns before making it executable.
#
# `gcloud run deploy --source=.` uploads the working directory, not what git
# stored, and `.gitattributes` only governs the latter. An editor or a script
# that writes CRLF on Windows therefore ships a `#!/bin/sh\r` the kernel cannot
# resolve, and the container dies at start-up with "no such file or directory"
# naming a path that plainly exists. Normalising here makes the image immune to
# whatever the build host's line endings happen to be.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

# The port substitution and the access gate both happen at start-up, in
# `deploy/entrypoint.sh`. It refuses to start without credentials, which is the
# behaviour that matters: a deployment that quietly loses its gate looks exactly
# like one that never had it.
ENV PORT=8080
CMD ["/usr/local/bin/entrypoint.sh"]
