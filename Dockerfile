# Production image for BlackWater. One process serves the API, the web pages and
# Socket.IO, so it must run on a host that keeps a Node process alive (a
# container platform or a VM), not on a per-request serverless platform.
FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL to talk to PostgreSQL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Dependencies first, so this layer is cached until package files change. The
# schema is copied before `npm ci` because installing @prisma/client generates
# the client from it.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public

# Never run as root inside the container.
USER node

# The platform sets PORT; 8000 is the default used when it does not.
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# Apply pending migrations, then replace the shell with the server so that
# SIGTERM from the platform reaches Node and triggers its graceful shutdown.
# `migrate deploy` takes a database lock, so several starting instances are safe.
CMD ["sh", "-c", "npm run prisma:migrate:prod && exec node src/server.js"]
