import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { ALLOWED_ORIGINS } from './config/security.js';
import { isTiDB, queryOne, queryAll } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

// Import route modules
import authRouter from './routes/auth.js';
import bookingsRouter from './routes/bookings.js';
import driversRouter from './routes/drivers.js';
import adminRouter from './routes/admin.js';
import chatRouter from './routes/chat.js';
import pricingRouter from './routes/pricing.js';
import locationRouter from './routes/location.js';
import { ensureServicePricing } from './services/pricingService.js';

export const app = express();

// Trust proxy for rate limiters behind reverse proxies
app.set('trust proxy', 1);

// URL restoration middleware for Vercel Serverless Function rewrites
app.use((req, res, next) => {
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
  if (matchedPath && (req.url === '/api/index.js' || req.url === '/index.js' || req.url === '/api' || req.url === '/api/' || req.url === '/')) {
    req.url = matchedPath;
  }
  next();
});

// 1. Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://*.tile.openstreetmap.org"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app", "ws://localhost:*", "ws://127.0.0.1:*", "wss://*.vercel.app"]
    }
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' }, // Anti-clickjacking
  noSniff: true // MIME sniffing defense
}));

// 2. Strict CORS Configuration with Explicit Origin Allowlist
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server, same-origin)
    if (!origin) return callback(null, true);

    // In development and test environments, allow localhost and 127.0.0.1
    if (!ENV.IS_PRODUCTION) {
      try {
        const parsedUrl = new URL(origin);
        if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch (e) {}
    }

    // Verify against explicit allowlist from environment configuration
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Explicitly reject unauthorized origins (do NOT silently allow arbitrary origins)
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With']
}));

// 3. Body parsers with payload size limits (prevent resource exhaustion)
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// 4. Global API Rate Limiter (enforced on both /api and alias mount paths)
app.use(['/api', '/auth', '/bookings', '/drivers', '/admin', '/chat', '/pricing', '/location'], generalRateLimiter);

// 5. Minimal Public Healthcheck Endpoint (Zero internal metrics, counts, or configuration disclosure)
app.get(['/api/health', '/health'], async (req, res) => {
  let isDbHealthy = false;
  try {
    const testRow = await queryOne('SELECT 1 as test');
    isDbHealthy = Boolean(testRow);
  } catch (err) {
    isDbHealthy = false;
  }

  res.json({
    status: isDbHealthy ? 'healthy' : 'degraded',
    service: 'Book Driver Anna API',
    timestamp: new Date().toISOString()
  });
});

// 6. Mount API Route Modules (supporting both /api/ and direct paths for Vercel/proxy rewrite resilience)
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/bookings', bookingsRouter);
app.use('/api/drivers', driversRouter);
app.use('/drivers', driversRouter);
app.use('/api/admin', adminRouter);
app.use('/admin', adminRouter);
app.use('/api/chat', chatRouter);
app.use('/chat', chatRouter);
app.use('/api/pricing', pricingRouter);
app.use('/pricing', pricingRouter);
app.use('/api/location', locationRouter);
app.use('/location', locationRouter);

// 7. Serve Production Frontend Static Assets (if dist exists)
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    // If request is a GET and does not target an API route, serve the SPA entrypoint
    const isApiRequest = req.path.startsWith('/api') || 
      req.path.startsWith('/auth') || 
      req.path.startsWith('/bookings') || 
      req.path.startsWith('/drivers') || 
      req.path.startsWith('/admin') || 
      req.path.startsWith('/chat') ||
      req.path.startsWith('/pricing') ||
      req.path.startsWith('/location');

    if (req.method === 'GET' && !isApiRequest) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
}

// 8. 404 and Centralized Error Handling for API routes
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize DB seed & ensure service pricing in all environments
ensureServicePricing().catch((err) => console.error('[PRICING ENSURE ERROR]', err.message));

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_SEED !== 'true') {
  console.log('[SEED] Skipping database seed in production (set ALLOW_DB_SEED=true to override)');
} else {
  seedDatabase().catch((err) => console.error('[SEED ERROR]', err.message));
}

// Start HTTP Server if run directly (and not in test or Vercel serverless environment)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Book Driver Anna API running on http://0.0.0.0:${ENV.PORT} (PID: ${process.pid})`);
  });

  if (process.env.DISABLE_EMBEDDED_REALTIME !== 'true') {
    import('./services/realtimeService.js').then(({ RealtimeServer, setGlobalRealtimeServer }) => {
      const realtimeServer = new RealtimeServer({
        port: ENV.REALTIME_PORT || 5001,
        internalSecret: ENV.REALTIME_INTERNAL_SECRET || ''
      });
      realtimeServer.start().then(() => {
        setGlobalRealtimeServer(realtimeServer);
        console.log(`[REALTIME] WebSocket Server running on ws://0.0.0.0:${ENV.REALTIME_PORT || 5001}/realtime`);
      }).catch(err => console.error('[REALTIME] Failed to start embedded realtime server:', err.message));
    });
  }
}
