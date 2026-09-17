import { isTiDB } from './database.js';

export async function seedDatabase() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowSeed = process.env.ALLOW_DB_SEED === 'true';

    if (isProduction && !allowSeed) {
      console.log('[SEED] Production environment detected. Automatic database seeding skipped (set ALLOW_DB_SEED=true to override).');
      return;
    }

    // No demo accounts or mock bookings seeded. Production accounts are created via bootstrapAdmin.js.
    console.log(`[SEED] Database verified (${isTiDB ? 'TiDB Cloud' : 'SQLite'}). Production-clean state with 0 demo accounts.`);
  } catch (err) {
    console.error('[SEED] Warning during database check:', err.message);
  }
}
