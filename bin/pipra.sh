#!/bin/sh
# Pipra CLI Entrypoint Wrapper
exec /usr/bin/node /usr/lib/pipra/server.js "$@"
