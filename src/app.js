import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { globalErrorHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import apiRoutes from './routes/index.js';
import { pages, publicDir, notFoundPage } from './pages.js';

const app = express();

// Behind a reverse proxy every request appears to come from the proxy. Telling
// Express how many proxies to trust makes req.ip (and the rate limits) use the
// visitor's real address from X-Forwarded-For.
if (env.TRUST_PROXY > 0) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// helmet's default Content-Security-Policy, tightened: scripts and styles may
// only load from this server, and inline scripts, event-handler attributes and
// inline styles are all blocked (no page uses any of them). That is what makes
// text inserted into a page unable to run as code.
// 'upgrade-insecure-requests' is only meaningful behind HTTPS and breaks
// http://localhost in Safari, so it is sent in production only.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'style-src': ["'self'"],
        'upgrade-insecure-requests': env.NODE_ENV === 'production' ? [] : null,
      },
    },
  })
);

// For load balancers and uptime monitors. It reports the database too: a server
// that is running but cannot reach its database is not healthy, and should be
// taken out of rotation rather than answering every request with an error.
// The commit lets a deployment check confirm that the version it just pushed is
// the one answering (a green health check alone could be the previous release).
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', database: 'UP', commit: env.commit });
  } catch {
    res.status(503).json({ status: 'DOWN', database: 'DOWN', commit: env.commit });
  }
});

// The rate limit and JSON body parsing apply to the API only: one page load
// fetches a dozen static files, and those must not eat into the request budget.
// Responses carry private data (incidents, people), and the same URL returns
// different data to different users, so no browser or shared cache may keep them.
const noStore = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

app.use('/api', noStore, apiLimiter, express.json(), apiRoutes);

// The web pages and their assets (public/css, public/js).
app.use(express.static(publicDir, { index: false, extensions: false }));

for (const [urlPattern, file] of pages) {
  app.get(urlPattern, (req, res) => res.sendFile(file, { root: publicDir }));
}

app.use((req, res) => {
  res.status(404).sendFile(notFoundPage, { root: publicDir });
});

// Must be registered last so it receives errors from everything above.
app.use(globalErrorHandler);

export default app;
