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
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

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
