import bcrypt from 'bcryptjs';
import { getDb } from './connection.js';

/**
 * Get the current schema version from the database.
 */
function getSchemaVersion(db: any): number {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'schema_version'").get() as any;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Set the schema version in the database.
 */
function setSchemaVersion(db: any, version: number): void {
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = ?"
  ).run(String(version), String(version));
}

/**
 * Run all database migrations. Creates tables if they don't exist.
 * Uses a versioned migration system so each migration runs only once.
 * Safe to call multiple times.
 */
export function runMigrations(): void {
  const db = getDb();

  // ═══════════════════════════════════════════════════
  // Phase 1: Create base tables (idempotent via IF NOT EXISTS)
  // ═══════════════════════════════════════════════════
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      avatar TEXT NOT NULL DEFAULT '',
      must_change_password INTEGER NOT NULL DEFAULT 0,
      firstname TEXT NOT NULL DEFAULT '',
      lastname TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      license_plate TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      year INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '',
      vin TEXT NOT NULL DEFAULT '',
      hsn TEXT NOT NULL DEFAULT '',
      tsn TEXT NOT NULL DEFAULT '',
      mileage REAL NOT NULL DEFAULT 0,
      purchase_date TEXT NOT NULL DEFAULT '',
      purchase_price REAL NOT NULL DEFAULT 0,
      total_expenses REAL NOT NULL DEFAULT 0,
      next_tuev_date TEXT NOT NULL DEFAULT '',
      image_path TEXT NOT NULL DEFAULT '',
      udp_token TEXT NOT NULL DEFAULT '',
      engine_runtime INTEGER NOT NULL DEFAULT 0,
      engine_status TEXT NOT NULL DEFAULT 'off' CHECK(engine_status IN ('off','ignition','running')),
      fuel_level REAL NOT NULL DEFAULT 0,
      last_seen TEXT NOT NULL DEFAULT '',
      fuel_type_vehicle TEXT NOT NULL DEFAULT '',
      engine_type TEXT NOT NULL DEFAULT '',
      power_ps INTEGER NOT NULL DEFAULT 0,
      displacement_cc INTEGER NOT NULL DEFAULT 0,
      transmission TEXT NOT NULL DEFAULT '',
      drivetrain TEXT NOT NULL DEFAULT '',
      doors INTEGER NOT NULL DEFAULT 0,
      seats INTEGER NOT NULL DEFAULT 0,
      curb_weight_kg INTEGER NOT NULL DEFAULT 0,
      first_registration TEXT NOT NULL DEFAULT '',
      insurance_company TEXT NOT NULL DEFAULT '',
      insurance_number TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('oil_change','inspection','custom_inspection','tuev','repair','invoice','fuel_stop')),
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      mileage INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      fuel_amount REAL,
      fuel_price_per_liter REAL,
      fuel_type TEXT,
      interval_days INTEGER,
      interval_km INTEGER,
      interval_engine_hours INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_intervals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      maintenance_type TEXT NOT NULL,
      interval_days INTEGER,
      interval_km INTEGER,
      interval_engine_hours INTEGER,
      last_notified TEXT,
      UNIQUE(vehicle_id, maintenance_type)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS passkey_credentials (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      device_name TEXT NOT NULL DEFAULT 'Passkey',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicle_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      share_token TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      expires_at TEXT,
      label TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicle_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      can_view INTEGER NOT NULL DEFAULT 1,
      can_edit INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, vehicle_id)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_token ON vehicles(udp_token);
    CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_notification_vehicle ON notification_intervals(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id);
    CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_share_token ON vehicle_shares(share_token);
    CREATE INDEX IF NOT EXISTS idx_share_vehicle ON vehicle_shares(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_perm_user ON vehicle_permissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_perm_vehicle ON vehicle_permissions(vehicle_id);
  `);

  // Case-insensitive unique constraint for username
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(lower(username))');
  } catch (_e) { /* ignore */ }

  // ═══════════════════════════════════════════════════
  // Phase 2: Seed default data
  // ═══════════════════════════════════════════════════

  // Seed default app settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM app_settings').get() as { count: number };
  if (settingsCount.count === 0) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('registration_enabled', '0')").run();
  }

  // Seed a default admin user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, email, password_hash, role, must_change_password)
      VALUES (?, ?, ?, ?, 1)
    `).run('admin', 'admin@example.com', hash, 'admin');
    console.log('  ✓ Default admin user created (admin / admin123)');
  }

  // ═══════════════════════════════════════════════════
  // Phase 3: Versioned incremental migrations
  // Each migration runs only once and bumps the schema version.
  // ═══════════════════════════════════════════════════
  const currentVersion = getSchemaVersion(db);

  // --- Migration v1: Add columns that might be missing on older databases ---
  if (currentVersion < 1) {
    console.log('  ➜ Running migration v1: ensure all columns exist...');

    // Users columns
    const userColumns = [
      "ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE users ADD COLUMN firstname TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE users ADD COLUMN lastname TEXT NOT NULL DEFAULT ''",
    ];
    for (const sql of userColumns) {
      try { db.exec(sql); } catch (_e) { /* already exists */ }
    }

    // Vehicle extended detail columns
    const vehicleColumns = [
      "ALTER TABLE vehicles ADD COLUMN fuel_type_vehicle TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE vehicles ADD COLUMN engine_type TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE vehicles ADD COLUMN power_ps INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE vehicles ADD COLUMN displacement_cc INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE vehicles ADD COLUMN transmission TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE vehicles ADD COLUMN drivetrain TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE vehicles ADD COLUMN doors INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE vehicles ADD COLUMN seats INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE vehicles ADD COLUMN curb_weight_kg INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE vehicles ADD COLUMN first_registration TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE vehicles ADD COLUMN insurance_company TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE vehicles ADD COLUMN insurance_number TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE vehicles ADD COLUMN notes TEXT NOT NULL DEFAULT ''",
    ];
    for (const sql of vehicleColumns) {
      try { db.exec(sql); } catch (_e) { /* already exists */ }
    }

    setSchemaVersion(db, 1);
    console.log('  ✓ Migration v1 complete');
  }

  // --- Migration v2: Fix mileage type (INTEGER → REAL) and repair broken FK references ---
  if (currentVersion < 2) {
    const vehiclesSchema = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='vehicles'").get() as any)?.sql || '';

    // Check if the vehicles table has INTEGER mileage (needs migration)
    // OR if there's a stale vehicles_old table (from a previously broken migration)
    const needsMileageMigration = vehiclesSchema.includes('mileage INTEGER');
    const hasStaleVehiclesOld = !!(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vehicles_old'").get());

    if (needsMileageMigration || hasStaleVehiclesOld) {
      console.log('  ➜ Running migration v2: fix mileage type & foreign keys...');

      // CRITICAL: Disable foreign keys for table recreation.
      // SQLite FK references follow table renames, which breaks them.
      db.pragma('foreign_keys = OFF');

      try {
        db.transaction(() => {
          // If there's a stale vehicles_old from a previous broken migration, recover data
          if (hasStaleVehiclesOld) {
            // Drop the (possibly empty) new vehicles table that was created by the broken migration
            const vehicleCount = (db.prepare('SELECT COUNT(*) as c FROM vehicles').get() as any)?.c || 0;
            const oldCount = (db.prepare('SELECT COUNT(*) as c FROM vehicles_old').get() as any)?.c || 0;

            if (oldCount > 0 && vehicleCount === 0) {
              // Data is in vehicles_old, new vehicles table is empty → restore from old
              db.exec('DROP TABLE IF EXISTS vehicles');
              db.exec('ALTER TABLE vehicles_old RENAME TO vehicles');
              console.log('    Recovered data from vehicles_old');
            } else if (vehicleCount > 0) {
              // New table has data, drop the old one
              db.exec('DROP TABLE IF EXISTS vehicles_old');
            } else {
              // Both empty, just clean up
              db.exec('DROP TABLE IF EXISTS vehicles_old');
            }
          }

          // Now check again if mileage migration is still needed
          const schema = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='vehicles'").get() as any)?.sql || '';
          if (schema.includes('mileage INTEGER')) {
            // Get all columns from the current vehicles table
            const columns = db.pragma('table_info(vehicles)') as any[];
            const columnNames = columns.map((c: any) => c.name);

            // Rename current table
            db.exec('ALTER TABLE vehicles RENAME TO vehicles_migrate');

            // Create new vehicles table with REAL mileage and all columns
            db.exec(`
              CREATE TABLE vehicles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                license_plate TEXT NOT NULL DEFAULT '',
                brand TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                year INTEGER NOT NULL DEFAULT 0,
                color TEXT NOT NULL DEFAULT '',
                vin TEXT NOT NULL DEFAULT '',
                hsn TEXT NOT NULL DEFAULT '',
                tsn TEXT NOT NULL DEFAULT '',
                mileage REAL NOT NULL DEFAULT 0,
                purchase_date TEXT NOT NULL DEFAULT '',
                purchase_price REAL NOT NULL DEFAULT 0,
                total_expenses REAL NOT NULL DEFAULT 0,
                next_tuev_date TEXT NOT NULL DEFAULT '',
                image_path TEXT NOT NULL DEFAULT '',
                udp_token TEXT NOT NULL DEFAULT '',
                engine_runtime INTEGER NOT NULL DEFAULT 0,
                engine_status TEXT NOT NULL DEFAULT 'off' CHECK(engine_status IN ('off','ignition','running')),
                fuel_level REAL NOT NULL DEFAULT 0,
                last_seen TEXT NOT NULL DEFAULT '',
                fuel_type_vehicle TEXT NOT NULL DEFAULT '',
                engine_type TEXT NOT NULL DEFAULT '',
                power_ps INTEGER NOT NULL DEFAULT 0,
                displacement_cc INTEGER NOT NULL DEFAULT 0,
                transmission TEXT NOT NULL DEFAULT '',
                drivetrain TEXT NOT NULL DEFAULT '',
                doors INTEGER NOT NULL DEFAULT 0,
                seats INTEGER NOT NULL DEFAULT 0,
                curb_weight_kg INTEGER NOT NULL DEFAULT 0,
                first_registration TEXT NOT NULL DEFAULT '',
                insurance_company TEXT NOT NULL DEFAULT '',
                insurance_number TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
              )
            `);

            // Build column list for copy (only columns that exist in both old and new)
            const newColumns = (db.pragma('table_info(vehicles)') as any[]).map((c: any) => c.name);
            const commonColumns = columnNames.filter((n: string) => newColumns.includes(n));
            const selectCols = commonColumns.map((n: string) =>
              n === 'mileage' ? 'CAST(mileage AS REAL) as mileage' : n
            ).join(', ');
            const insertCols = commonColumns.join(', ');

            db.exec(`INSERT INTO vehicles (${insertCols}) SELECT ${selectCols} FROM vehicles_migrate`);
            db.exec('DROP TABLE vehicles_migrate');

            // Recreate indexes
            db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_token ON vehicles(udp_token)');

            console.log('    Migrated mileage column to REAL');
          }

          // ── Fix foreign key integrity ──
          // Rebuild maintenance_records to ensure FK references point to current vehicles table
          const maintSchema = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='maintenance_records'").get() as any)?.sql || '';
          if (maintSchema) {
            // Check FK integrity
            const fkCheck = db.pragma('foreign_key_check(maintenance_records)') as any[];
            if (fkCheck.length > 0) {
              console.log(`    Repairing ${fkCheck.length} broken FK references in maintenance_records...`);
              // Delete orphaned records (whose vehicle_id doesn't exist in vehicles)
              db.exec(`
                DELETE FROM maintenance_records
                WHERE vehicle_id NOT IN (SELECT id FROM vehicles)
              `);
            }
          }
        })();
      } finally {
        // ALWAYS re-enable foreign keys
        db.pragma('foreign_keys = ON');
      }

      console.log('  ✓ Migration v2 complete');
    }

    setSchemaVersion(db, 2);
  }

  // ── Verify FK integrity on every startup ──
  db.pragma('foreign_keys = OFF');
  try {
    const fkErrors = db.pragma('foreign_key_check') as any[];
    if (fkErrors.length > 0) {
      console.log(`  ⚠ Found ${fkErrors.length} foreign key violations, cleaning up...`);
      for (const err of fkErrors) {
        try {
          if (err.table === 'maintenance_records') {
            db.prepare('DELETE FROM maintenance_records WHERE rowid = ?').run(err.rowid);
          } else if (err.table === 'notification_intervals') {
            db.prepare('DELETE FROM notification_intervals WHERE rowid = ?').run(err.rowid);
          } else if (err.table === 'vehicle_shares') {
            db.prepare('DELETE FROM vehicle_shares WHERE rowid = ?').run(err.rowid);
          } else if (err.table === 'vehicle_permissions') {
            db.prepare('DELETE FROM vehicle_permissions WHERE rowid = ?').run(err.rowid);
          }
        } catch (_e) { /* ignore individual cleanup errors */ }
      }
      console.log('  ✓ Foreign key violations cleaned');
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }

  // ─── Future migrations go here ───
  // if (currentVersion < 3) {
  //   console.log('  ➜ Running migration v3: ...');
  //   // ... migration logic ...
  //   setSchemaVersion(db, 3);
  //   console.log('  ✓ Migration v3 complete');
  // }
}
