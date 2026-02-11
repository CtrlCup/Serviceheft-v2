import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getConfig } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!db) {
        const config = getConfig();
        if (config.database.type === 'sqlite') {
            const dbPath = path.resolve(__dirname, '../../', config.database.sqlite.path);
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
            db = new Database(dbPath);
            db.pragma('journal_mode = WAL');
            db.pragma('foreign_keys = ON');
        } else {
            // MySQL / PostgreSQL: placeholder for future driver integration
            throw new Error(`Database type "${config.database.type}" is not yet implemented. Use "sqlite" for now.`);
        }
    }
    return db;
}

export function closeDb(): void {
    if (db) {
        db.close();
        db = null;
    }
}
