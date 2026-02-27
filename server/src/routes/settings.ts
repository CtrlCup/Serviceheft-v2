import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from '../database/connection.js';
import { AuthRequest } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// ─── Avatar Upload Config ───────────────────────
const avatarDir = path.resolve(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, avatarDir),
        filename: (req: any, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `user-${req.userId}-${Date.now()}${ext}`);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Nur Bilddateien (JPG, PNG, GIF, WebP) erlaubt'));
    },
});

/** Helper: format user for response */
function formatUser(user: any) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        notificationsEnabled: !!user.notifications_enabled,
        avatar: user.avatar || '',
        firstname: user.firstname || '',
        lastname: user.lastname || '',
    };
}

/** PUT /api/settings/notifications – Toggle notifications on/off */
router.put('/notifications', (req: AuthRequest, res: Response): void => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        res.status(400).json({ success: false, error: '"enabled" (boolean) is required' });
        return;
    }

    const db = getDb();
    db.prepare('UPDATE users SET notifications_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.userId!);
    res.json({ success: true, data: { notificationsEnabled: enabled } });
});

/** PUT /api/settings/profile – Update own profile (username, email, password, names) */
router.put('/profile', (req: AuthRequest, res: Response): void => {
    const { username, email, currentPassword, newPassword, firstname, lastname } = req.body;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as any;
    if (!user) { res.status(404).json({ success: false, error: 'Benutzer nicht gefunden' }); return; }

    // If changing password, verify current password (skip check if forced change)
    if (newPassword) {
        const mustChange = !!user.must_change_password;
        if (!mustChange) {
            if (!currentPassword) {
                res.status(400).json({ success: false, error: 'Aktuelles Passwort erforderlich' });
                return;
            }
            if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
                res.status(401).json({ success: false, error: 'Aktuelles Passwort ist falsch' });
                return;
            }
        }
        if (newPassword.length < 6) {
            res.status(400).json({ success: false, error: 'Neues Passwort muss mindestens 6 Zeichen lang sein' });
            return;
        }
        const hash = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, req.userId!);
    }

    // Update username if provided and different
    if (username && username !== user.username) {
        const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.userId!);
        if (existing) {
            res.status(409).json({ success: false, error: 'Benutzername bereits vergeben' });
            return;
        }
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.userId!);
    }

    // Update email
    if (email && email !== user.email) {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.userId!);
    }

    // Update names
    if (firstname !== undefined) {
        db.prepare('UPDATE users SET firstname = ? WHERE id = ?').run(firstname, req.userId!);
    }
    if (lastname !== undefined) {
        db.prepare('UPDATE users SET lastname = ? WHERE id = ?').run(lastname, req.userId!);
    }

    const updated = db.prepare('SELECT id, username, email, role, notifications_enabled, avatar, firstname, lastname FROM users WHERE id = ?').get(req.userId!) as any;
    res.json({ success: true, data: formatUser(updated) });
});

// ─── Avatar Upload ──────────────────────────────

/** POST /api/settings/avatar – Upload or replace avatar */
router.post('/avatar', avatarUpload.single('avatar'), (req: AuthRequest, res: Response): void => {
    if (!req.file) {
        res.status(400).json({ success: false, error: 'Kein Bild hochgeladen' });
        return;
    }

    const db = getDb();
    const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.userId!) as any;

    // Delete old avatar file if it exists
    if (user?.avatar) {
        const oldPath = path.resolve(__dirname, '../../', user.avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarPath = `uploads/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarPath, req.userId!);

    res.json({ success: true, data: { avatar: avatarPath } });
});

/** DELETE /api/settings/avatar – Remove avatar */
router.delete('/avatar', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.userId!) as any;

    if (user?.avatar) {
        const filePath = path.resolve(__dirname, '../../', user.avatar);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare("UPDATE users SET avatar = '' WHERE id = ?").run(req.userId!);
    res.json({ success: true, data: { avatar: '' } });
});

// ─── Passkeys ───────────────────────────────────

/** GET /api/settings/passkeys – List user's passkeys */
router.get('/passkeys', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const passkeys = db.prepare(
        'SELECT id, device_name, created_at FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.userId!);
    res.json({ success: true, data: passkeys });
});

/** POST /api/settings/passkeys – Register a new passkey (stub for WebAuthn flow) */
router.post('/passkeys', (req: AuthRequest, res: Response): void => {
    const { credentialId, publicKey, deviceName } = req.body;
    if (!credentialId || !publicKey) {
        res.status(400).json({ success: false, error: 'credentialId and publicKey are required' });
        return;
    }

    const db = getDb();
    db.prepare(
        'INSERT INTO passkey_credentials (id, user_id, public_key, device_name) VALUES (?, ?, ?, ?)'
    ).run(credentialId, req.userId!, publicKey, deviceName || 'Passkey');

    const passkeys = db.prepare(
        'SELECT id, device_name, created_at FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.userId!);
    res.json({ success: true, data: passkeys });
});

/** DELETE /api/settings/passkeys/:id – Remove a passkey */
router.delete('/passkeys/:id', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    db.prepare('DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
    res.json({ success: true });
});

// ─── Notification Intervals ─────────────────────

/** GET /api/settings/intervals/:vehicleId – Get notification intervals for a vehicle */
router.get('/intervals/:vehicleId', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.vehicleId, req.userId!);
    if (!vehicle) { res.status(404).json({ success: false, error: 'Vehicle not found' }); return; }

    const intervals = db.prepare(
        'SELECT * FROM notification_intervals WHERE vehicle_id = ? ORDER BY maintenance_type'
    ).all(req.params.vehicleId);
    res.json({ success: true, data: intervals });
});

/** PUT /api/settings/intervals/:vehicleId – Set/update intervals */
router.put('/intervals/:vehicleId', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.vehicleId, req.userId!);
    if (!vehicle) { res.status(404).json({ success: false, error: 'Vehicle not found' }); return; }

    const { maintenanceType, intervalDays, intervalKm, intervalEngineHours } = req.body;
    if (!maintenanceType) {
        res.status(400).json({ success: false, error: 'maintenanceType is required' });
        return;
    }

    db.prepare(`
    INSERT INTO notification_intervals (vehicle_id, maintenance_type, interval_days, interval_km, interval_engine_hours)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(vehicle_id, maintenance_type) DO UPDATE SET
      interval_days = excluded.interval_days,
      interval_km = excluded.interval_km,
      interval_engine_hours = excluded.interval_engine_hours
  `).run(req.params.vehicleId, maintenanceType, intervalDays ?? null, intervalKm ?? null, intervalEngineHours ?? null);

    const intervals = db.prepare(
        'SELECT * FROM notification_intervals WHERE vehicle_id = ? ORDER BY maintenance_type'
    ).all(req.params.vehicleId);
    res.json({ success: true, data: intervals });
});

export default router;
