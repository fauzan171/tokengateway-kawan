#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=2048"
exec /usr/bin/node ./node_modules/next/dist/bin/next dev -p 3010 -H 0.0.0.0
