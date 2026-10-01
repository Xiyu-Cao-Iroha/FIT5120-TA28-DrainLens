# DrainLens API on Cloud Run: five GET routes over Postgres, and the job that
# fills it.
#
# **This is not at the repository root, and that is the whole reason the build
# is driven by `cloudbuild.yaml` instead of `--source=.`.** `gcloud run deploy
# --source=.` looks for `./Dockerfile` and nothing else — that slot belongs to
# the site — so a second service from the same repository has to name its
# Dockerfile explicitly. The alternative, giving the API its own repository or
# its own build context, would separate it from the artefacts it loads, and
# those artefacts are the reason the database has anything in it.
#
# The build context is still the repository root. See `deploy/api/cloudbuild.yaml`.
#
# One image, two entry points:
#
#   node apps/api/dist/server.js    the service  (Cloud Run service)
#   node apps/api/dist/migrate.js   schema + rows (Cloud Run job)
#
# The job and the service share an image on purpose: a migration built from a
# different commit than the server it is migrating for is a class of failure
# nobody can reproduce afterwards.

# **Base images are pinned by digest** (penetration test P06, P07). A moving
# name such as `node:22-alpine` meant two builds of one commit could ship
# different operating-system packages, and the image only picked up fixes when
# the application happened to change. The tag is kept beside the digest so a
# reader can see what it is; the digest is what Docker uses. To move to a newer
# base, look up the new digest (deploy/README.md, "Rebuilding on a schedule"),
# change both Dockerfiles, and let CI's image scan run on the pull request.

FROM node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
WORKDIR /repo

# The lockfile first, so only a dependency change busts the layer cache.
# `npm ci`, never `npm install`: it installs exactly what the lockfile says and
# fails when it and package.json have drifted.
COPY package.json package-lock.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/scenario/package.json packages/scenario/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci

COPY . .
RUN npm run build --workspace @drainlens/api

FROM node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime
WORKDIR /app

# The same lockfile, without the toolchain: twenty-three packages against the
# hundreds the build needs. Resolved from the lockfile rather than re-resolved,
# so the image cannot quietly get a different `pg` than the tests ran against.
COPY package.json package-lock.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/scenario/package.json packages/scenario/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev && npm cache clean --force

# **Then the package managers go, and the OS packages are brought up to date**
# (penetration test P06; the CI image scan). The server is started with `node`
# and never installs anything, but the Node base image ships npm, yarn and
# corepack with their own dependency trees -- a CRITICAL in tar and ten HIGHs
# on 16 September, none of them in this application's modules -- and its
# Alpine layer lagged a libssl fix. Removing what nothing runs is simpler than
# tracking those trees. Node carries its own OpenSSL, which `apk` does not
# touch and the scan cannot see; that one moves only with the base image's
# digest (deploy/README.md, "Rebuilding on a schedule").
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/lib/node_modules/corepack /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=build /repo/apps/api/dist apps/api/dist
COPY db/migrations db/migrations

# **The layout below `/app` is load-bearing.** `load.ts` resolves the artefacts
# as `../../web/public/data` relative to its own file, which is `apps/web/public/data`
# from either `apps/api/src` or `apps/api/dist`, and `migrate.ts` resolves
# `db/migrations` the same way. Flattening this image would break both at run
# time and neither at build time.
#
# Six files, not the directory: `scene/` is 8 MB of terrain the browser reads
# and the loader never opens, and `addresses.json` is never meant to leave the
# browser. **A file the loader reads and this list forgets is a load that fails
# inside a Cloud Run job**, which is the slowest place in this project to find
# anything out.
COPY apps/web/public/data/map.json \
     apps/web/public/data/derived.json \
     apps/web/public/data/trace.json \
     apps/web/public/data/flood-history.json \
     apps/web/public/data/sa2-areas.json \
     apps/web/public/data/population.json \
     apps/web/public/data/

# The council extent, which is what the migration job loads when it is given
# `--extent city-of-melbourne`. It is committed rather than built here because
# `/data` -- where the pipeline writes it -- is in `.dockerignore`, so an
# artefact built into the working directory is not in the build context and
# cannot be copied out of it. No flood history: that board is Greater
# Melbourne's and is read from the bundled copy above whichever extent is
# loaded.
COPY apps/api/data apps/api/data

# Nothing here writes to disk, so it has no reason to be able to.
USER node

# Cloud Run overrides this; the default keeps a local `docker run` honest.
ENV PORT=8080
CMD ["node", "apps/api/dist/server.js"]
