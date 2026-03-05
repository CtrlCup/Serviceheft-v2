import bcrypt from 'bcryptjs';
import { getDb } from './connection.js';

/**
 * Run all database migrations. Creates tables if they don't exist.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      avatar TEXT NOT NULL DEFAULT '',
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
      mileage INTEGER NOT NULL DEFAULT 0,
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

    CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_token ON vehicles(udp_token);
    CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_notification_vehicle ON notification_intervals(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);

    -- Case-insensitive unique constraint for username
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(lower(username));

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
    CREATE INDEX IF NOT EXISTS idx_share_token ON vehicle_shares(share_token);
    CREATE INDEX IF NOT EXISTS idx_share_vehicle ON vehicle_shares(vehicle_id);

    CREATE TABLE IF NOT EXISTS vehicle_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      can_view INTEGER NOT NULL DEFAULT 1,
      can_edit INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, vehicle_id)
    );
    CREATE INDEX IF NOT EXISTS idx_perm_user ON vehicle_permissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_perm_vehicle ON vehicle_permissions(vehicle_id);
  `);

  // ─── Incremental migrations for existing databases ────
  // Add avatar column to users if it doesn't exist yet
  try {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''");
    console.log('  ✓ Migration: added avatar column to users');
  } catch (_e) {
    // Column already exists – ignore
  }

  // Add must_change_password column
  try {
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
    console.log('  ✓ Migration: added must_change_password column to users');
  } catch (_e) {
    // Column already exists – ignore
  }

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

  // ─── Migration: Add firstname/lastname to users ───
  try {
    const tableInfo = db.pragma('table_info(users)') as any[];
    if (!tableInfo.some(c => c.name === 'firstname')) {
      db.exec("ALTER TABLE users ADD COLUMN firstname TEXT NOT NULL DEFAULT ''");
      console.log('  ✓ Migration: added firstname to users');
    }
    if (!tableInfo.some(c => c.name === 'lastname')) {
      db.exec("ALTER TABLE users ADD COLUMN lastname TEXT NOT NULL DEFAULT ''");
      console.log('  ✓ Migration: added lastname to users');
    }
  } catch (e) {
    console.error('  ! Migration error (firstname/lastname):', e);
  }

  // ─── Migration: Mileage precision (REAL) in vehicles ───
  // We need to check if mileage is already REAL or if we need to migrate.
  // Since SQLite columns have flexible types, we can just start storing floats.
  // However, to be "Strict", we should ideally update the schema definition.
  // SQLite doesn't support changing column type directly. We must recreate the table.
  // We will check if the schema definition contains "mileage INTEGER".
  const vehiclesSchema = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='vehicles'").get() as any).sql;
  if (vehiclesSchema && vehiclesSchema.includes('mileage INTEGER')) {
    console.log('  ➜ Migrating vehicles table to support REAL mileage...');
    db.transaction(() => {
      // 1. Rename old table
      db.exec('ALTER TABLE vehicles RENAME TO vehicles_old');

      // 2. Create new table with REAL mileage (and other fields same as before)
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
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `);

      // 3. Copy data
      db.exec(`
            INSERT INTO vehicles (
                id, user_id, license_plate, brand, model, year, color, vin, hsn, tsn, 
                mileage, purchase_date, purchase_price, total_expenses, next_tuev_date, 
                image_path, udp_token, engine_runtime, engine_status, fuel_level, last_seen, created_at
            )
            SELECT 
                id, user_id, license_plate, brand, model, year, color, vin, hsn, tsn, 
                CAST(mileage AS REAL), purchase_date, purchase_price, total_expenses, next_tuev_date, 
                image_path, udp_token, engine_runtime, engine_status, fuel_level, last_seen, created_at
            FROM vehicles_old
          `);

      // 4. Recreate indexes
      db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_token ON vehicles(udp_token)');

      // 5. Drop old table
      db.exec('DROP TABLE vehicles_old');
    })();
    console.log('  ✓ Migration: vehicles table updated to REAL mileage');
  }
}
