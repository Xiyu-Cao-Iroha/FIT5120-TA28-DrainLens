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

FROM node:22-alpine AS build
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

FROM node:22-alpine AS runtime
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

COPY --from=build /repo/apps/api/dist apps/api/dist
COPY db/migrations db/migrations

# **The layout below `/app` is load-bearing.** `load.ts` resolves the artefacts
# as `../../web/public/data` relative to its own file, which is `apps/web/public/data`
# from either `apps/api/src` or `apps/api/dist`, and `migrate.ts` resolves
# `db/migrations` the same way. Flattening this image would break both at run
# time and neither at build time.
#
# Four files, not the directory: `scene/` is 8 MB of terrain the browser reads
# and the loader never opens.
COPY apps/web/public/data/map.json \
     apps/web/public/data/derived.json \
     apps/web/public/data/trace.json \
     apps/web/public/data/flood-history.json \
     apps/web/public/data/

# Nothing here writes to disk, so it has no reason to be able to.
USER node

# Cloud Run overrides this; the default keeps a local `docker run` honest.
ENV PORT=8080
CMD ["node", "apps/api/dist/server.js"]
