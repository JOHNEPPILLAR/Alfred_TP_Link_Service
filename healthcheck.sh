#!/usr/bin/env sh

set -x
set -e

echo "Set env vars"
export ENVIRONMENT="production"
export PORT=3978

node lib/server/healthcheck.js

exit $?