import { execute } from '../db/database.js';

export async function logAuditEvent({
  userId = null,
  action,
  resourceType,
  resourceId = null,
  details = null,
  ipAddress = null
}) {
  try {
    await execute(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      userId,
      action,
      resourceType,
      resourceId,
      typeof details === 'object' ? JSON.stringify(details) : details,
      ipAddress
    ]);
  } catch (err) {
    console.error('[AUDIT ERROR] Failed to record audit log:', err.message);
  }
}
