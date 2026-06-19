# Deployment Guide

---

## Local Development (Quick Start)

```bash
# Backend
git clone https://github.com/Ayush-o1/BlackWater.git
cd BlackWater
npm install
cp .env.example .env         # fill in DATABASE_URL and JWT_SECRET
npx prisma migrate dev       # run migrations
npx prisma db seed           # load demo data
npm run dev                  # starts on port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                  # starts on port 5173
```

---

## Build for Production

**Backend:**
```bash
# Compile TypeScript to JavaScript
npm run build
# Output goes to ./dist/

# Run the compiled server
npm start
# Runs dist/server.js via Node
```

**Frontend:**
```bash
cd frontend
npm run build
# Output goes to frontend/dist/
# Serve this as a static site (Vercel, Netlify, Nginx, etc.)
```

---

## Environment Variables

**Backend (.env):**
```bash
DATABASE_URL="postgresql://user:password@host:5432/blackwater?schema=public"
JWT_SECRET="a-strong-secret-at-least-32-chars"
PORT=8000
NODE_ENV=production
JWT_EXPIRES_IN=1d
```

**Frontend (.env in frontend/ directory):**
```bash
VITE_API_URL=https://your-backend-url.com
```

If `VITE_API_URL` is not set, the frontend defaults to `http://localhost:8000`.

---

## Database Migrations

```bash
# Apply pending migrations (development)
npx prisma migrate dev

# Apply migrations in production (does not reset data)
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate
```

---

## Deployment Notes

**Socket.IO and CORS:**
The socket server currently allows all origins (`cors: { origin: '*' }`). Before deploying, change this in `src/socket/socket.server.ts` to your actual frontend URL:
```typescript
cors: {
  origin: 'https://your-frontend-url.com',
  methods: ['GET', 'POST'],
}
```

Also update the CORS settings in `src/app.ts` for the REST API.

**JWT Secret:**
Use a long, randomly generated secret for production. At minimum 32 characters. Example to generate one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Health Check:**
The `/health` endpoint returns `{ status: 'UP' }` and can be used for load balancer health checks.

---

## Seeding Demo Data

```bash
npx prisma db seed
```

This creates:
- 1 organization (`BlackWater Demo Corp`)
- Admin user: `admin@BlackWater.com` / `password123`
- Member user: `bob@BlackWater.com` / `password123`
- 3 sample services
- 1 resolved historical incident
- 1 active incident with updates and timeline events

After seeding, the organization ID is printed to the console. Use it for the public status page URL: `/status/<orgId>`.
