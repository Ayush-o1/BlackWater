# Deployment Guide

BlackWater is architected for containerized, highly available deployments. It relies on horizontal scalability and stateless API nodes.

## 1. Production Architecture Overview

*   **Frontend**: Built as a static Vite SPA, deployed to a global Edge CDN (e.g., Vercel, AWS CloudFront, Cloudflare Pages).
*   **Backend**: Node.js Express API wrapped in a Docker container, orchestrated via Kubernetes (EKS/GKE) or fully managed container services (AWS ECS/Fargate).
*   **Database**: Managed PostgreSQL instance (e.g., AWS RDS, Supabase) configured for Multi-AZ high availability.
*   **Real-Time Sync**: A managed Redis cluster (e.g., AWS ElastiCache) utilizing the Socket.IO Redis Adapter. This ensures WebSocket events emitted by Node A reach clients connected to Node B.

## 2. Environment Variables

A production deployment requires the following strictly configured environment variables:

```bash
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public&connection_limit=20
JWT_SECRET=strong_secure_random_string
CORS_ORIGIN=https://status.blackwater.com
REDIS_URL=redis://host:6379
```

## 3. Docker Deployment Strategy

### Building the Backend Image

A multi-stage Dockerfile is utilized to keep the final artifact minimal and secure.

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 8000
CMD ["npm", "start"]
```

### Starting Services via Docker Compose

For single-node or staging environments:

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://db_user:db_pass@db:5432/blackwater
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: db_user
      POSTGRES_PASSWORD: db_pass
      POSTGRES_DB: blackwater
  redis:
    image: redis:7-alpine
```

## 4. Monitoring & Observability

Once deployed, the following metrics should be aggressively monitored:

*   **PostgreSQL**: Connection count and `pg_stat_statements` for slow queries.
*   **Node.js**: Event loop lag and memory heap utilization (critical for WebSocket intensive applications).
*   **Redis**: Memory usage and eviction rates.
*   **Infrastructure**: Uptime of the health check endpoint (`GET /api/health`).
