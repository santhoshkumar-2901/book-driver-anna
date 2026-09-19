import { execute, queryAll } from '../db/database.js';

export async function cleanDatabaseForProduction() {
  console.log('[CLEANUP] Starting production database cleanup...');

  // 1. Delete all bookings
  await execute('DELETE FROM bookings');
  console.log('[CLEANUP] All bookings cleared.');

  // 2. Delete all drivers
  await execute('DELETE FROM drivers');
  console.log('[CLEANUP] All drivers cleared.');

  // 3. Delete all non-admin users and dummy demo admin
  await execute(`
    DELETE FROM users 
    WHERE role != 'admin' OR email = 'admin@bookdriveranna.com'
  `);
  console.log('[CLEANUP] All non-admin customers and default demo accounts removed.');

  // 4. Clear audit logs
  await execute('DELETE FROM audit_logs');
  console.log('[CLEANUP] Audit logs cleared.');

  const remainingAdmins = await queryAll('SELECT id, name, email, phone, role FROM users WHERE role = ?', ['admin']);
  console.log('[CLEANUP] Retained authentic admin account(s):', remainingAdmins);
  console.log('[CLEANUP] Production database is now 100% clean and ready for launch.');
  return { success: true, remainingAdmins };
}

// Execute directly if run via CLI
const isMain = process.argv[1] && process.argv[1].endsWith('cleanDatabase.js');
if (isMain) {
  cleanDatabaseForProduction()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[CLEANUP ERROR]:', err);
      process.exit(1);
    });
}
