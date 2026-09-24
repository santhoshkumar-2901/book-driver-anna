import { ENV } from '../config/env.js';

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint '${req.originalUrl}' does not exist on this server.`
    }
  });
}

export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || (err.status ? Number(err.status) : null);
  let errorCode = err.code;

  // Map database constraint violations (SQLite, TiDB, MySQL) to 409 Conflict with clear messages
  const msg = (err.message || '').toLowerCase();
  if (
    err.code === 'ER_DUP_ENTRY' ||
    err.code === 'SQLITE_CONSTRAINT' ||
    err.code === 'ERR_SQLITE_ERROR' && msg.includes('unique') ||
    msg.includes('unique constraint') ||
    msg.includes('duplicate entry')
  ) {
    statusCode = 409;
    errorCode = 'USER_ALREADY_EXISTS';
    if (msg.includes('license') || msg.includes('dl') || msg.includes('license_number')) {
      err.message = 'This Driving License (DL) number is already registered. Please log in.';
    } else if (msg.includes('phone')) {
      err.message = 'This mobile number is already registered. Please log in.';
    } else if (msg.includes('email')) {
      err.message = 'This email address is already registered. Please log in.';
    } else {
      err.message = 'An account with these details is already registered. Please log in.';
    }
  }

  statusCode = statusCode || 500;
  errorCode = errorCode || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  // Log error internally with stack trace
  console.error(`[API ERROR] ${req.method} ${req.originalUrl} - ${statusCode} [${errorCode}]:`, err.message);
  if (statusCode >= 500 && err.stack) {
    console.error(err.stack);
  }

  // Sanitize message for client
  const clientMessage = (statusCode >= 500 && ENV.IS_PRODUCTION)
    ? 'An unexpected error occurred. Our engineering team has been notified.'
    : (err.message || 'An error occurred processing your request.');

  // Set diagnostic header for inspection in serverless production environments
  if (err.message) {
    res.setHeader('X-Debug-Error-Msg', String(err.message).replace(/[\r\n]+/g, ' ').substring(0, 200));
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: clientMessage
    }
  });
}
