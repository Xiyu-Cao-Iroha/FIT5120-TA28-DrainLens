#!/usr/bin/env bash
#
# Publish the built site to a Cloud Storage bucket.
#
#   ./deploy/publish.sh gs://drainlens-ta28-site            # show what it would do
#   ./deploy/publish.sh gs://drainlens-ta28-site --apply    # do it
#
# Uploads in three passes because the three classes of file need three
# different cache policies, and getting that wrong fails in ways that look
# like the site working:
#
#   /assets/*    content-hashed by Vite, so immutable forever
#   /index.html  names the hashed assets, so it must never be cached
#   /data/*      NOT hashed, so a long cache serves a map that disagrees
#                with the model it was built beside
#
# Everything is uploaded gzipped. Cloud Storage does not compress on the fly,
# and without this the first visit is 5.77 MB instead of 1.31 MB.
#
# Dry run by default. This publishes to a public bucket, and a script that
# does that on an unexamined command line is a script that does it by
# accident.

set -euo pipefail

BUCKET="${1:-}"
APPLY="${2:-}"
DIST="apps/web/dist"

if [[ -z "$BUCKET" || "$BUCKET" != gs://* ]]; then
  echo "usage: $0 gs://BUCKET [--apply]" >&2
  exit 2
fi

run() {
  if [[ "$APPLY" == "--apply" ]]; then
    "$@"
  else
    printf '  '
    printf '%q ' "$@"
    printf '\n'
  fi
}

echo "==> Building"
if [[ "$APPLY" == "--apply" ]]; then
  npm run build --workspace @drainlens/web
else
  echo "  npm run build --workspace @drainlens/web"
fi

if [[ ! -d "$DIST" ]]; then
  echo "no build at $DIST — run the build first" >&2
  exit 1
fi

# --gzip-local-all, NOT --gzip-in-flight-all. The two read alike and do
# different things:
#
#   --gzip-in-flight-all  compresses the upload to Cloud Storage. The stored
#                         object is NOT gzip-encoded, so browsers get it raw.
#   --gzip-local-all      compresses locally and stores the object with
#                         Content-Encoding: gzip, which is what makes Cloud
#                         Storage serve it compressed.
#
# Only the second takes the first visit from 5.77 MB to 1.31 MB, and choosing
# the wrong one fails silently: the site works, four times heavier. Check it
# with `curl -I -H 'Accept-Encoding: gzip'` after deploying.
#
# Content types are set explicitly rather than guessed, and that failure is
# silent too: a module worker served as anything but a JavaScript type is
# refused by the browser, while the map still draws.

echo
echo "==> /assets — content-hashed, cached forever"
run gcloud storage cp --recursive "$DIST/assets" "$BUCKET/" \
  --gzip-local-all \
  --cache-control="public, max-age=31536000, immutable" \
  --content-type="text/javascript"

echo
echo "==> /data — not hashed, so a short cache only"
for kind in json bin; do
  case "$kind" in
    json) type="application/json" ;;
    bin)  type="application/octet-stream" ;;
  esac
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    target="$BUCKET/${file#"$DIST"/}"
    run gcloud storage cp "$file" "$target" \
      --gzip-local-all \
      --cache-control="public, max-age=300" \
      --content-type="$type"
  done < <(find "$DIST/data" -type f -name "*.$kind" | sort)
done

echo
echo "==> /index.html — never cached; it names the hashed assets"
run gcloud storage cp "$DIST/index.html" "$BUCKET/index.html" \
  --gzip-local-all \
  --cache-control="no-cache" \
  --content-type="text/html; charset=utf-8"

echo
if [[ "$APPLY" == "--apply" ]]; then
  echo "Published. Now take the 'after' measurement and say where you ran it:"
  echo "  node tools/perf/measure.mjs https://YOUR.DOMAIN 100"
  echo
  echo "Then run the four checks in deploy/README.md — in particular that no"
  echo "load balancer request log exists, which is what AD1 rests on here."
else
  echo "Dry run. Nothing was uploaded. Re-run with --apply to publish."
fi
