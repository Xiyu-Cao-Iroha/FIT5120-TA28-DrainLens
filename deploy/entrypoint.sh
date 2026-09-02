#!/bin/sh
# Start nginx with the access gate in place, or do not start at all.
#
# The gate is a course requirement (Week 6 studio: "put a password/access gate
# in front of the whole deployed website, before users can even reach your
# application"), and it is separate from anything in the product. DrainLens has
# no product login and will not get one — AD1 says it holds no identity — so
# website-level protection is the only kind available to it, which is exactly
# the distinction the slides draw.
#
# **It fails closed.** If the credentials are not configured, this exits and the
# container never serves. That is deliberate and it is the whole point: a
# deployment that quietly loses its gate is indistinguishable from one that
# never had it, and this repository has already been bitten twice by exactly
# that shape of failure — `--source=.` silently falling back to Buildpacks, and
# a log exclusion written to a field that stored it and did nothing. Cloud Run
# keeps the previous revision serving when a new one fails to start, so the
# cost of failing closed is a failed deploy you can see, not an outage you
# cannot.
set -eu

if [ -z "${BASIC_AUTH_USER:-}" ] || [ -z "${BASIC_AUTH_HASH:-}" ]; then
  echo "FATAL: BASIC_AUTH_USER and BASIC_AUTH_HASH must both be set." >&2
  echo "       Without them this container would serve an unfinished student" >&2
  echo "       project to anyone who found the URL, so it refuses to start." >&2
  echo "       See deploy/README.md for how to generate the hash." >&2
  exit 1
fi

# The password never exists here: BASIC_AUTH_HASH is already a hash, generated
# on somebody's own machine and passed in at deploy time. Nothing in this image
# or in the repository can be turned back into a password.
printf '%s:%s\n' "${BASIC_AUTH_USER}" "${BASIC_AUTH_HASH}" > /etc/nginx/.htpasswd
chmod 600 /etc/nginx/.htpasswd

# Cloud Run sends traffic to $PORT and does not promise it is 8080. nginx has
# no variable expansion in `listen`, so the port is substituted at start-up
# rather than baked in — a container that ignores $PORT is one Cloud Run marks
# unhealthy for reasons the logs do not explain.
sed -i "s/listen 8080;/listen ${PORT:-8080};/" /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
