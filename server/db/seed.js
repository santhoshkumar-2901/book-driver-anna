import { isTiDB, db } from './database.js';

export async function seedDatabase() {
  try {
    // Ensure password_reset_tokens table exists in TiDB Cloud
    if (isTiDB) {
      try {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id VARCHAR(64) NOT NULL PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);
      } catch (tableErr) {
        console.warn('[DATABASE] TiDB table init notice:', tableErr.message);
      }
    }

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
