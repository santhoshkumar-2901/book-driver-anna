import { db } from '../db/database.js';

export function logAuditEvent({
  userId = null,
  action,
  resourceType,
  resourceId = null,
  details = null,
  ipAddress = null
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId,
      action,
      resourceType,
      resourceId,
      typeof details === 'object' ? JSON.stringify(details) : details,
      ipAddress
    );
  } catch (err) {
    console.error('[AUDIT ERROR] Failed to record audit log:', err.message);
  }
}
