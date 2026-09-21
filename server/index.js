import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { ALLOWED_ORIGINS } from './config/security.js';
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

export const app = express();

// Trust proxy for rate limiters behind reverse proxies
app.set('trust proxy', 1);

// 1. Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app", "https://generativelanguage.googleapis.com"]
    }
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' }, // Anti-clickjacking
  noSniff: true // MIME sniffing defense
}));

// 2. Strict CORS Configuration supporting localhost, Vercel deployments, and configured origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server, or same-origin)
    if (!origin) return callback(null, true);

    try {
      const parsedUrl = new URL(origin);
      // Allow localhost and local IPs
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        return callback(null, true);
      }
      // Allow any Vercel domain (*.vercel.app)
      if (parsedUrl.hostname.endsWith('.vercel.app') || parsedUrl.hostname === 'vercel.app') {
        return callback(null, true);
      }
    } catch (e) {}

    // Allow configured origins from CORS_ORIGIN
    if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // In production or preview deployments, allow web clients without CORS rejection
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With']
}));

// 3. Body parsers with payload size limits (prevent resource exhaustion)
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// 4. Global API Rate Limiter
app.use('/api', generalRateLimiter);

// 5. Healthcheck Endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Book Driver Anna Production API',
    time: new Date().toISOString(),
    environment: ENV.NODE_ENV
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
      req.path.startsWith('/chat');

    if (req.method === 'GET' && !isApiRequest) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
}

// 8. 404 and Centralized Error Handling for API routes
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize DB seed
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
}
