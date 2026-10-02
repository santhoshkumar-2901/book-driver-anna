import { RealtimeServer, setGlobalRealtimeServer } from './services/realtimeService.js';
import { ENV } from './config/env.js';

const port = ENV.REALTIME_PORT || 5001;
const internalSecret = ENV.REALTIME_INTERNAL_SECRET || '';

console.log(`[REALTIME BOOT] Initializing Book Driver Anna Realtime Server on port ${port}...`);

const server = new RealtimeServer({
  port,
  internalSecret
});

setGlobalRealtimeServer(server);

try {
  await server.start();
  console.log(`[REALTIME SERVER] Running on ws://0.0.0.0:${port}/realtime (Internal HTTP: http://0.0.0.0:${port})`);
} catch (err) {
  console.error('[REALTIME SERVER ERROR] Failed to start:', err.message);
  process.exit(1);
}

// Graceful shutdown handling
const shutdown = async () => {
  console.log('\n[REALTIME SERVER] Shutting down gracefully...');
  await server.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
