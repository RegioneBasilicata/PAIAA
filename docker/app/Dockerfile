# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS production

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8784 \
    AIGH_DATA_DIR=/app/server/data

# Il runtime usa soltanto moduli Node integrati (incluso node:sqlite).
# Non servono npm install, toolchain o build degli asset.
COPY --chown=node:node package.json index.html LICENSE NOTICE THIRD_PARTY_NOTICES.md ./
COPY --chown=node:node server/ ./server/
COPY --chown=node:node assets/ ./assets/
COPY --chown=node:node data/ ./data/
COPY --chown=node:node LICENSES/ ./LICENSES/
COPY --chown=node:node docker/app/healthcheck.js ./healthcheck.js

RUN node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major !== 24 || minor < 13) process.exit(1); require('node:sqlite')" \
    && mkdir -p /app/server/data \
    && chown node:node /app/server/data \
    && chmod 700 /app/server/data

USER node
EXPOSE 8784
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=20 \
    CMD ["node", "/app/healthcheck.js"]
CMD ["node", "server/server.js"]
