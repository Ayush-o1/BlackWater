import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
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

// helmet's default Content-Security-Policy is kept: scripts and styles may only
// load from this server, and inline scripts and event-handler attributes are
// blocked. That is what makes text inserted into a page unable to run as code.
// 'upgrade-insecure-requests' is only meaningful behind HTTPS and breaks
// http://localhost in Safari, so it is sent in production only.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'upgrade-insecure-requests': env.NODE_ENV === 'production' ? [] : null,
      },
    },
  })
);

// Only the configured frontend origin(s) may call the API from a browser.
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()), credentials: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'BlackWater API is healthy' });
});

// The rate limit and JSON body parsing apply to the API only: one page load
// fetches a dozen static files, and those must not eat into the request budget.
app.use('/api', apiLimiter, express.json(), apiRoutes);

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
