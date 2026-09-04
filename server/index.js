import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { ALLOWED_ORIGINS } from './config/security.js';
import { seedDatabase } from './db/seed.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

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
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*", "https://generativelanguage.googleapis.com"]
    }
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' }, // Anti-clickjacking
  noSniff: true // MIME sniffing defense
}));

// 2. Strict CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Book Driver Anna Production API',
    time: new Date().toISOString(),
    environment: ENV.NODE_ENV
  });
});

// 6. Mount API Route Modules
app.use('/api/auth', authRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRouter);

// 7. 404 and Centralized Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize DB seed
seedDatabase();

// Start HTTP Server if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Book Driver Anna API running on http://0.0.0.0:${ENV.PORT} (PID: ${process.pid})`);
  });
}
