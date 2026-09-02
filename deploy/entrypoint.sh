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

# The hash must still look like one, and this check is not pedantry.
#
# An apr1 hash is `$apr1$salt$digest` and a bcrypt one is `$2y$...`. Both are
# full of `$`, so a deploy command that quotes them with double quotes has the
# shell expand `$apr1` and `$salt` to nothing before gcloud ever sees them --
# leaving a value like `.`, which is short, wrong, and *not empty*. The guard
# above would pass it, nginx would start, and the site would be locked to
# everybody including the person holding the password. That is worse than
# failing closed: it looks like a working deployment until somebody tries.
#
# Checked by shape rather than by verifying a password, because the password is
# deliberately not here to verify against.
case "${BASIC_AUTH_HASH}" in
  '$apr1$'*|'$2y$'*|'$2a$'*|'$2b$'*|'$1$'*|'$5$'*|'$6$'*|'{SHA}'*) ;;
  *)
    echo "FATAL: BASIC_AUTH_HASH is not a password hash in a format nginx reads." >&2
    echo "       Got ${#BASIC_AUTH_HASH} characters starting with:" \
         "$(printf '%.6s' "${BASIC_AUTH_HASH}")" >&2
    echo "       The usual cause is quoting. A hash contains \$ signs, so it must" >&2
    echo "       be passed in SINGLE quotes -- in double quotes the shell expands" >&2
    echo "       them away and leaves a short, wrong, non-empty value." >&2
    echo "       See deploy/README.md, 'The password is never in this repository'." >&2
    exit 1
    ;;
esac

# The password never exists here: BASIC_AUTH_HASH is already a hash, generated
# on somebody's own machine and passed in at deploy time. Nothing in this image
# or in the repository can be turned back into a password.
printf '%s:%s\n' "${BASIC_AUTH_USER}" "${BASIC_AUTH_HASH}" > /etc/nginx/.htpasswd

# Readable by the worker, which is not the process that wrote it.
#
# nginx opens `auth_basic_user_file` in a worker, and workers drop to an
# unprivileged user; this script runs as root. At 600 and owned by root the
# worker gets EACCES, and the failure is a nasty shape: a request with no
# credentials never opens the file and still gets a clean 401, so the gate
# looks like it is working, while a request with the *correct* password gets
# 500. It fails only for the person who has the password.
#
# 444 rather than a tighter mode with a chown, because a chown that silently
# fails puts it straight back. The file holds a username and a hash, and
# anything that can read it is already inside the container.
chmod 444 /etc/nginx/.htpasswd

# Cloud Run sends traffic to $PORT and does not promise it is 8080. nginx has
# no variable expansion in `listen`, so the port is substituted at start-up
# rather than baked in — a container that ignores $PORT is one Cloud Run marks
# unhealthy for reasons the logs do not explain.
sed -i "s/listen 8080;/listen ${PORT:-8080};/" /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
