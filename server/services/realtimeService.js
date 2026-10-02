import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken, getUserById } from './authService.js';
import { queryOne, queryAll } from '../db/database.js';
import { ENV } from '../config/env.js';

/**
 * RealtimeServer manages authenticated WebSocket connections,
 * booking-scoped subscriptions, and driver location dispatching.
 */
export class RealtimeServer {
  constructor(options = {}) {
    this.port = options.port || ENV.REALTIME_PORT || 5001;
    this.internalSecret = options.internalSecret || ENV.REALTIME_INTERNAL_SECRET || '';
    this.server = options.server || null; // Optional existing http.Server
    this.wss = null;
    this.httpServer = null;
    this.ownsHttpServer = false;

    // Subscriptions: Map<bookingId, Set<WebSocket>>
    this.bookingRooms = new Map();
    // Connected admin sockets: Set<WebSocket>
    this.adminSockets = new Set();
    // Socket metadata: WeakMap<WebSocket, { user, subscriptions, messageCount, lastReset, isAlive, authTimeout }>
    this.socketMeta = new WeakMap();

    this.pingInterval = null;
    this.isClosing = false;
  }

  /**
   * Start the Realtime HTTP + WebSocket server
   */
  async start() {
    if (this.server) {
      this.wss = new WebSocketServer({ server: this.server, path: '/realtime' });
    } else {
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });
      this.ownsHttpServer = true;
      this.wss = new WebSocketServer({ server: this.httpServer, path: '/realtime' });

      await new Promise((resolve, reject) => {
        this.httpServer.listen(this.port, '0.0.0.0', () => {
          resolve();
        });
        this.httpServer.on('error', reject);
      });
    }

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start 30s heartbeat interval to clean up stale/dead sockets
    this.pingInterval = setInterval(() => {
      if (this.isClosing || !this.wss) return;
      for (const client of this.wss.clients) {
        const meta = this.socketMeta.get(client);
        if (!meta) continue;
        if (!meta.isAlive) {
          try {
            client.terminate();
          } catch (e) {}
          continue;
        }
        meta.isAlive = false;
        try {
          client.ping();
        } catch (e) {}
      }
    }, 30000);

    return this;
  }

  /**
   * Handle internal HTTP requests (Healthcheck + Serverless Publish Webhook)
   */
  handleHttpRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // 1. Healthcheck
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'healthy',
        service: 'Book Driver Anna Realtime Service',
        connections: this.wss ? this.wss.clients.size : 0,
        rooms: this.bookingRooms.size,
        timestamp: new Date().toISOString()
      }));
    }

    // 2. Internal Publish Webhook (Called by Vercel serverless functions when publishing driver GPS)
    if (req.method === 'POST' && url.pathname === '/internal/publish') {
      const authSecret = req.headers['x-internal-secret'] || '';
      if (!this.internalSecret || authSecret !== this.internalSecret) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid internal secret' } }));
      }

      let bodyText = '';
      req.on('data', chunk => {
        bodyText += chunk;
        if (bodyText.length > 32768) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeded 32KB' } }));
          req.destroy();
        }
      });

      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyText);
          const result = await this.publishDriverLocation(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: err.message } }));
        }
      });
      return;
    }

    // 3. Internal Publish Assignment Webhook
    if (req.method === 'POST' && url.pathname === '/internal/publish-assignment') {
      const authSecret = req.headers['x-internal-secret'] || '';
      if (!this.internalSecret || authSecret !== this.internalSecret) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid internal secret' } }));
      }

      let bodyText = '';
      req.on('data', chunk => {
        bodyText += chunk;
        if (bodyText.length > 32768) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeded 32KB' } }));
          req.destroy();
        }
      });

      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyText);
          const result = await this.publishBookingAssignmentChange(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: err.message } }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }

  /**
   * Handle incoming WebSocket connection
   */
  handleConnection(ws, req) {
    const meta = {
      user: null,
      subscriptions: new Set(),
      messageCount: 0,
      lastReset: Date.now(),
      isAlive: true,
      authTimeout: null
    };
    this.socketMeta.set(ws, meta);

    // Enforce 10-second authentication timeout: client must authenticate or be disconnected
    meta.authTimeout = setTimeout(() => {
      if (!meta.user && ws.readyState === WebSocket.OPEN) {
        this.sendJson(ws, {
          type: 'error',
          code: 'AUTH_TIMEOUT',
          message: 'Connection closed: Authentication required within 10 seconds.'
        });
        ws.close(4001, 'Authentication Timeout');
      }
    }, 10000);

    ws.on('pong', () => {
      meta.isAlive = true;
    });

    ws.on('message', async (data) => {
      await this.handleSocketMessage(ws, data);
    });

    ws.on('close', () => {
      this.handleSocketClose(ws);
    });

    ws.on('error', (err) => {
      console.warn('[REALTIME] Socket error:', err.message);
      this.handleSocketClose(ws);
    });
  }

  /**
   * Safe JSON send helper
   */
  sendJson(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(obj));
      } catch (e) {}
    }
  }

  /**
   * Process incoming WebSocket message
   */
  async handleSocketMessage(ws, rawData) {
    const meta = this.socketMeta.get(ws);
    if (!meta) return;

    // Simple per-socket rate limiting: max 30 messages/sec
    const now = Date.now();
    if (now - meta.lastReset > 1000) {
      meta.lastReset = now;
      meta.messageCount = 0;
    }
    meta.messageCount += 1;
    if (meta.messageCount > 30) {
      this.sendJson(ws, {
        type: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Message rate limit exceeded. Please slow down.'
      });
      return;
    }

    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch (err) {
      this.sendJson(ws, {
        type: 'error',
        code: 'INVALID_JSON',
        message: 'Payload must be valid JSON.'
      });
      return;
    }

    if (!msg || typeof msg !== 'object' || !msg.type) {
      this.sendJson(ws, {
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: 'Message must include a valid type property.'
      });
      return;
    }

    switch (msg.type) {
      case 'ping':
        this.sendJson(ws, { type: 'pong' });
        break;

      case 'authenticate':
        await this.handleAuthenticate(ws, msg);
        break;

      case 'subscribe':
        await this.handleSubscribe(ws, msg);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(ws, msg);
        break;

      default:
        this.sendJson(ws, {
          type: 'error',
          code: 'UNKNOWN_MESSAGE_TYPE',
          message: `Unknown message type: ${msg.type}`
        });
        break;
    }
  }

  /**
   * Authenticate socket using JWT
   */
  async handleAuthenticate(ws, msg) {
    const meta = this.socketMeta.get(ws);
    if (!meta) return;

    const token = msg.token || msg.payload?.token;
    if (!token || typeof token !== 'string') {
      this.sendJson(ws, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication token required.'
      });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      this.sendJson(ws, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.'
      });
      ws.close(4001, 'Invalid Token');
      return;
    }

    const user = await getUserById(decoded.id);
    if (!user || user.status !== 'Active') {
      this.sendJson(ws, {
        type: 'error',
        code: 'ACCOUNT_DISABLED',
        message: 'Account is disabled or not found.'
      });
      ws.close(4001, 'Account Disabled');
      return;
    }

    if (meta.authTimeout) {
      clearTimeout(meta.authTimeout);
      meta.authTimeout = null;
    }

    meta.user = {
      id: user.id,
      name: user.name,
      phone: user.phone || null,
      role: (user.role || 'customer').toLowerCase(),
      driverId: user.driverId || null
    };

    if (meta.user.role === 'admin') {
      this.adminSockets.add(ws);
    }

    this.sendJson(ws, {
      type: 'authenticated',
      userId: user.id,
      role: meta.user.role
    });
  }

  /**
   * Handle booking channel subscription with strict authorization
   */
  async handleSubscribe(ws, msg) {
    const meta = this.socketMeta.get(ws);
    if (!meta || !meta.user) {
      this.sendJson(ws, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required before subscribing to location updates.'
      });
      return;
    }

    const bookingId = (msg.bookingId || msg.channel || '').trim();
    if (!bookingId) {
      this.sendJson(ws, {
        type: 'error',
        code: 'MISSING_BOOKING_ID',
        message: 'Booking ID is required to subscribe.'
      });
      return;
    }

    // Lookup booking from database
    const booking = await queryOne('SELECT id, user_id, customer_phone, assigned_driver_id, status FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      this.sendJson(ws, {
        type: 'error',
        code: 'BOOKING_NOT_FOUND',
        bookingId,
        message: 'Booking not found.'
      });
      return;
    }

    // Verify ownership / authorization
    let isAuthorized = false;
    if (meta.user.role === 'admin') {
      isAuthorized = true;
    } else if (meta.user.role === 'customer') {
      if (booking.user_id && booking.user_id === meta.user.id) {
        isAuthorized = true;
      } else if (booking.customer_phone && meta.user.phone) {
        const cleanUserPhone = String(meta.user.phone).replace(/[^0-9]/g, '').slice(-10);
        const cleanBookingPhone = String(booking.customer_phone).replace(/[^0-9]/g, '').slice(-10);
        if (cleanUserPhone && cleanBookingPhone && cleanUserPhone === cleanBookingPhone) {
          isAuthorized = true;
        }
      }
    } else if (meta.user.role === 'driver' && meta.user.driverId && booking.assigned_driver_id === meta.user.driverId) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      this.sendJson(ws, {
        type: 'error',
        code: 'FORBIDDEN',
        bookingId,
        message: 'Access denied: You are not authorized to observe this booking location.'
      });
      return;
    }

    // Add socket to room
    if (!this.bookingRooms.has(bookingId)) {
      this.bookingRooms.set(bookingId, new Set());
    }
    this.bookingRooms.get(bookingId).add(ws);
    meta.subscriptions.add(bookingId);

    this.sendJson(ws, {
      type: 'subscribed',
      bookingId
    });

    // If driver is assigned and has a known location, immediately push initial location
    if (booking.assigned_driver_id) {
      const driver = await queryOne(
        'SELECT id, current_latitude, current_longitude, last_location_update FROM drivers WHERE id = ?',
        [booking.assigned_driver_id]
      );

      if (driver && driver.current_latitude !== null && driver.current_longitude !== null) {
        this.sendJson(ws, {
          type: 'driver.location.initial',
          bookingId: booking.id,
          driverId: driver.id,
          latitude: Number(driver.current_latitude),
          longitude: Number(driver.current_longitude),
          timestamp: driver.last_location_update || new Date().toISOString()
        });
      }
    }
  }

  /**
   * Handle unsubscription
   */
  handleUnsubscribe(ws, msg) {
    const meta = this.socketMeta.get(ws);
    const bookingId = (msg.bookingId || '').trim();
    if (!bookingId) return;

    if (this.bookingRooms.has(bookingId)) {
      this.bookingRooms.get(bookingId).delete(ws);
      if (this.bookingRooms.get(bookingId).size === 0) {
        this.bookingRooms.delete(bookingId);
      }
    }
    if (meta) {
      meta.subscriptions.delete(bookingId);
    }

    this.sendJson(ws, {
      type: 'unsubscribed',
      bookingId
    });
  }

  /**
   * Cleanup socket on disconnect
   */
  handleSocketClose(ws) {
    const meta = this.socketMeta.get(ws);
    if (meta) {
      if (meta.authTimeout) {
        clearTimeout(meta.authTimeout);
        meta.authTimeout = null;
      }
      for (const bookingId of meta.subscriptions) {
        if (this.bookingRooms.has(bookingId)) {
          this.bookingRooms.get(bookingId).delete(ws);
          if (this.bookingRooms.get(bookingId).size === 0) {
            this.bookingRooms.delete(bookingId);
          }
        }
      }
      meta.subscriptions.clear();
    }
    this.adminSockets.delete(ws);
  }

  /**
   * Publish driver location event to authorized subscribers
   */
  async publishDriverLocation({ driverId, latitude, longitude, timestamp }) {
    if (!driverId || latitude === undefined || longitude === undefined) {
      throw new Error('driverId, latitude, and longitude are required to publish location');
    }

    const parsedLat = Number(latitude);
    const parsedLng = Number(longitude);
    if (!isFinite(parsedLat) || !isFinite(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      throw new Error('Coordinates must be valid numbers within bounds');
    }

    // Query active bookings assigned to this driver
    const activeBookings = await queryAll(`
      SELECT id, user_id, status FROM bookings
      WHERE assigned_driver_id = ?
        AND status IN ('CONFIRMED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS')
    `, [driverId]);

    const eventTimestamp = timestamp || new Date().toISOString();
    let sentCount = 0;

    for (const booking of activeBookings) {
      const eventPayload = {
        type: 'driver.location.updated',
        bookingId: booking.id,
        driverId,
        latitude: parsedLat,
        longitude: parsedLng,
        timestamp: eventTimestamp
      };

      const sockets = this.bookingRooms.get(booking.id);
      if (sockets && sockets.size > 0) {
        for (const ws of sockets) {
          if (ws.readyState === WebSocket.OPEN) {
            this.sendJson(ws, eventPayload);
            sentCount += 1;
          }
        }
      }

      // Also dispatch to connected admins
      for (const adminWs of this.adminSockets) {
        if (adminWs.readyState === WebSocket.OPEN && (!sockets || !sockets.has(adminWs))) {
          this.sendJson(adminWs, eventPayload);
          sentCount += 1;
        }
      }
    }

    // If driver is not currently assigned to any active bookings, broadcast to connected admins for fleet tracking
    if (activeBookings.length === 0 && this.adminSockets.size > 0) {
      const eventPayload = {
        type: 'driver.location.updated',
        bookingId: null,
        driverId,
        latitude: parsedLat,
        longitude: parsedLng,
        timestamp: eventTimestamp
      };
      for (const adminWs of this.adminSockets) {
        if (adminWs.readyState === WebSocket.OPEN) {
          this.sendJson(adminWs, eventPayload);
          sentCount += 1;
        }
      }
    }

    return {
      success: true,
      activeBookingsCount: activeBookings.length,
      subscribersNotified: sentCount
    };
  }

  /**
   * Publish booking assignment update to authorized subscribers in room
   */
  async publishBookingAssignmentChange({ bookingId, assignedDriverId = null, assignedDriverName = null, status = null }) {
    if (!bookingId) {
      throw new Error('bookingId is required to publish assignment change');
    }

    const eventPayload = {
      type: 'booking.assignment.updated',
      bookingId,
      assignedDriverId: assignedDriverId || null,
      assignedDriverName: assignedDriverName || null,
      status: status || null,
      timestamp: new Date().toISOString()
    };

    const sockets = this.bookingRooms.get(bookingId);
    let sentCount = 0;

    if (sockets && sockets.size > 0) {
      const socketsToRemove = [];

      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          const meta = this.socketMeta.get(ws);

          // If the socket belongs to a driver who is NO LONGER the assigned driver:
          // Security: Unassign the driver socket from this booking room immediately!
          if (meta && meta.user && meta.user.role === 'driver') {
            if (!assignedDriverId || meta.user.driverId !== assignedDriverId) {
              this.sendJson(ws, {
                type: 'unsubscribed',
                bookingId,
                reason: 'DRIVER_UNASSIGNED'
              });
              socketsToRemove.push(ws);
              continue;
            }
          }

          this.sendJson(ws, eventPayload);
          sentCount += 1;
        }
      }

      for (const ws of socketsToRemove) {
        sockets.delete(ws);
        const meta = this.socketMeta.get(ws);
        if (meta) {
          meta.subscriptions.delete(bookingId);
        }
      }
      if (sockets.size === 0) {
        this.bookingRooms.delete(bookingId);
      }
    }

    // Also push initial location of newly assigned driver if they already have coordinates in DB
    if (assignedDriverId) {
      const driver = await queryOne(
        'SELECT id, current_latitude, current_longitude, last_location_update FROM drivers WHERE id = ?',
        [assignedDriverId]
      );
      if (driver && driver.current_latitude !== null && driver.current_longitude !== null) {
        const initialPayload = {
          type: 'driver.location.initial',
          bookingId,
          driverId: driver.id,
          latitude: Number(driver.current_latitude),
          longitude: Number(driver.current_longitude),
          timestamp: driver.last_location_update || new Date().toISOString()
        };
        const currentSockets = this.bookingRooms.get(bookingId);
        if (currentSockets) {
          for (const ws of currentSockets) {
            if (ws.readyState === WebSocket.OPEN) {
              this.sendJson(ws, initialPayload);
            }
          }
        }
      }
    }

    // Also dispatch assignment change to connected admins
    for (const adminWs of this.adminSockets) {
      if (adminWs.readyState === WebSocket.OPEN && (!sockets || !sockets.has(adminWs))) {
        this.sendJson(adminWs, eventPayload);
        sentCount += 1;
      }
    }

    return {
      success: true,
      subscribersNotified: sentCount
    };
  }

  /**
   * Close the Realtime Server and all client connections
   */
  async close() {
    this.isClosing = true;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.wss) {
      for (const client of this.wss.clients) {
        try {
          client.close(1000, 'Server Closing');
        } catch (e) {}
      }
      await new Promise(resolve => this.wss.close(resolve));
      this.wss = null;
    }

    if (this.httpServer && this.ownsHttpServer) {
      await new Promise(resolve => this.httpServer.close(resolve));
      this.httpServer = null;
    }

    this.bookingRooms.clear();
    this.adminSockets.clear();
  }
}

// Global active in-process realtime server instance (when running in unified/monolith mode)
let globalRealtimeServer = null;

export function setGlobalRealtimeServer(serverInstance) {
  globalRealtimeServer = serverInstance;
}

export function getGlobalRealtimeServer() {
  return globalRealtimeServer;
}

/**
 * Universal publisher function for driver location.
 * - If running in a process with an active RealtimeServer, dispatches in-memory directly.
 * - If running in serverless mode (Vercel) and REALTIME_SERVICE_URL is set, dispatches via internal HTTP webhook.
 * - Safe & non-blocking: never crashes the caller.
 */
export async function publishDriverLocation({ driverId, latitude, longitude, timestamp = null }) {
  // 1. Direct in-memory dispatch if realtime server is running in this process
  if (globalRealtimeServer) {
    return globalRealtimeServer.publishDriverLocation({ driverId, latitude, longitude, timestamp });
  }

  // 2. HTTP Webhook dispatch if standalone Realtime Service URL is configured (serverless deployment)
  if (ENV.REALTIME_SERVICE_URL) {
    try {
      const url = `${ENV.REALTIME_SERVICE_URL}/internal/publish`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': ENV.REALTIME_INTERNAL_SECRET || ''
        },
        body: JSON.stringify({ driverId, latitude, longitude, timestamp }),
        signal: AbortSignal.timeout(2500) // 2.5 second bounded timeout
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[REALTIME PUBLISH] Service returned HTTP ${res.status}: ${errorText}`);
        return { success: false, error: `HTTP ${res.status}` };
      }

      return await res.json();
    } catch (err) {
      console.warn(`[REALTIME PUBLISH] Failed to dispatch location to ${ENV.REALTIME_SERVICE_URL}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // 3. Fallback: No realtime transport active (graceful no-op)
  return { success: true, subscribersNotified: 0, status: 'no_realtime_transport' };
}

/**
 * Universal publisher function for booking assignment updates.
 * - If running in process with an active RealtimeServer, dispatches in-memory directly.
 * - If running in serverless mode (Vercel) and REALTIME_SERVICE_URL is set, dispatches via internal HTTP webhook.
 * - Safe & non-blocking: never crashes the caller.
 */
export async function publishBookingAssignmentChange({ bookingId, assignedDriverId = null, assignedDriverName = null, status = null }) {
  if (globalRealtimeServer) {
    return globalRealtimeServer.publishBookingAssignmentChange({ bookingId, assignedDriverId, assignedDriverName, status });
  }

  if (ENV.REALTIME_SERVICE_URL) {
    try {
      const url = `${ENV.REALTIME_SERVICE_URL}/internal/publish-assignment`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': ENV.REALTIME_INTERNAL_SECRET || ''
        },
        body: JSON.stringify({ bookingId, assignedDriverId, assignedDriverName, status }),
        signal: AbortSignal.timeout(2500)
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[REALTIME ASSIGNMENT PUBLISH] Service returned HTTP ${res.status}: ${errorText}`);
        return { success: false, error: `HTTP ${res.status}` };
      }

      return await res.json();
    } catch (err) {
      console.warn(`[REALTIME ASSIGNMENT PUBLISH] Failed to dispatch assignment to ${ENV.REALTIME_SERVICE_URL}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: true, subscribersNotified: 0, status: 'no_realtime_transport' };
}
