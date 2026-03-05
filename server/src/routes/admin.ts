import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getDb } from '../database/connection.js';
import { runMigrations } from '../database/migrations.js';
import { AuthRequest } from '../middleware/auth.js';
import { getConfig, reloadConfig } from '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// ─── User Management ────────────────────────────

/** GET /api/admin/users */
router.get('/users', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const users = db.prepare('SELECT id, username, email, role, notifications_enabled, must_change_password, created_at FROM users ORDER BY id').all();
    res.json({ success: true, data: users });
});

/** POST /api/admin/users */
router.post('/users', (req: AuthRequest, res: Response): void => {
    const { username, email, password, role = 'user' } = req.body;
    if (!username || !email || !password) {
        res.status(400).json({ success: false, error: 'Username, email, and password are required' });
        return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        res.status(409).json({ success: false, error: 'Username already exists' });
        return;
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO users (username, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)'
    ).run(username, email, hash, role);

    const user = db.prepare('SELECT id, username, email, role, notifications_enabled, must_change_password, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: user });
});

/** PUT /api/admin/users/:id */
router.put('/users/:id', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const { username, email, password, role } = req.body;
    if (username) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.params.id);
    if (email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.params.id);
    if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    if (password) {
        const hash = bcrypt.hashSync(password, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
    }

    const updated = db.prepare('SELECT id, username, email, role, notifications_enabled, must_change_password, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});

/** DELETE /api/admin/users/:id */
router.delete('/users/:id', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    // Prevent self-delete
    if (Number(req.params.id) === req.userId) {
        res.status(400).json({ success: false, error: 'Cannot delete yourself' });
        return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

/** PUT /api/admin/users/:id/force-password-change – Toggle must_change_password flag */
router.put('/users/:id/force-password-change', (req: AuthRequest, res: Response): void => {
    const { mustChange } = req.body;
    if (typeof mustChange !== 'boolean') {
        res.status(400).json({ success: false, error: '"mustChange" (boolean) is required' });
        return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    db.prepare('UPDATE users SET must_change_password = ? WHERE id = ?').run(mustChange ? 1 : 0, req.params.id);
    res.json({ success: true, data: { mustChangePassword: mustChange } });
});

/** POST /api/admin/users/:id/reset-password – Reset user password */
router.post('/users/:id/reset-password', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const user = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    // Generate random password
    const tempPassword = crypto.randomBytes(6).toString('base64url').slice(0, 12);
    const hash = bcrypt.hashSync(tempPassword, 10);

    // Set new password and force change on next login
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hash, user.id);

    // Try to send email if SMTP is configured
    const config = getConfig();
    if (config.smtp?.host && user.email) {
        const transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.port === 465,
            auth: { user: config.smtp.user, pass: config.smtp.password },
        });

        transporter.sendMail({
            from: config.smtp.from,
            to: user.email,
            subject: 'Ihr Passwort wurde zurückgesetzt – Digitales Serviceheft',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                    <h2>Passwort zurückgesetzt</h2>
                    <p>Hallo <strong>${user.username}</strong>,</p>
                    <p>Ihr Passwort wurde von einem Administrator zurückgesetzt.</p>
                    <p>Ihr neues temporäres Passwort lautet:</p>
                    <p style="font-size: 1.25rem; font-family: monospace; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; letter-spacing: 2px;"><strong>${tempPassword}</strong></p>
                    <p style="color:#888;font-size:0.875rem;">Bitte ändern Sie Ihr Passwort beim nächsten Login.</p>
                </div>
            `,
        }).then(() => {
            // Email sent successfully
        }).catch(err => console.error('Failed to send password reset email:', err));

        res.json({ success: true, data: { sent: true } });
    } else {
        // No SMTP – return password to admin
        res.json({ success: true, data: { sent: false, temporaryPassword: tempPassword } });
    }
});

// ─── SMTP Config ────────────────────────────────

/** GET /api/admin/smtp */
router.get('/smtp', (_req: AuthRequest, res: Response): void => {
    const config = getConfig();
    res.json({
        success: true,
        data: { ...config.smtp, password: config.smtp.password ? '••••••' : '' },
    });
});

/** PUT /api/admin/smtp */
router.put('/smtp', (req: AuthRequest, res: Response): void => {
    const configPath = path.resolve(__dirname, '../../../config.json');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    raw.smtp = { ...raw.smtp, ...req.body };
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    reloadConfig();
    res.json({ success: true, data: raw.smtp });
});

/** POST /api/admin/smtp/test – Send a test email */
router.post('/smtp/test', (req: AuthRequest, res: Response): void => {
    const { to } = req.body;
    if (!to) {
        res.status(400).json({ success: false, error: 'Empfänger-Adresse erforderlich' });
        return;
    }

    const config = getConfig();
    if (!config.smtp?.host) {
        res.status(400).json({ success: false, error: 'SMTP ist nicht konfiguriert' });
        return;
    }

    const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.password },
    });

    transporter.sendMail({
        from: config.smtp.name ? `"${config.smtp.name}" <${config.smtp.from}>` : config.smtp.from,
        to,
        subject: 'Test-Mail – Digitales Serviceheft',
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h2>✅ Test-Mail erfolgreich</h2>
                <p>Diese E-Mail wurde vom Digitalen Serviceheft gesendet, um die SMTP-Konfiguration zu testen.</p>
                <p style="color:#888;font-size:0.875rem;">Zeitstempel: ${new Date().toLocaleString('de-DE')}</p>
            </div>
        `,
    }).then(() => {
        res.json({ success: true, data: { message: 'Test-Mail erfolgreich gesendet' } });
    }).catch(err => {
        console.error('SMTP test failed:', err);
        res.status(500).json({ success: false, error: `Versand fehlgeschlagen: ${err.message}` });
    });
});

// ─── System Info ────────────────────────────────

/** GET /api/admin/system */
router.get('/system', (_req: AuthRequest, res: Response): void => {
    const config = getConfig();
    const db = getDb();
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const vehicleCount = (db.prepare('SELECT COUNT(*) as count FROM vehicles').get() as any).count;
    const recordCount = (db.prepare('SELECT COUNT(*) as count FROM maintenance_records').get() as any).count;
    const regSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'registration_enabled'").get() as any;
    res.json({
        success: true,
        data: {
            appName: config.appName,
            databaseType: config.database.type,
            udpPort: config.udp.port,
            udpEnabled: config.udp.enabled,
            autheliEnabled: config.auth.authelia.enabled,
            registrationEnabled: regSetting?.value === '1',
            stats: { users: userCount, vehicles: vehicleCount, maintenanceRecords: recordCount },
        },
    });
});

/** PUT /api/admin/registration – Toggle user registration on/off */
router.put('/registration', (req: AuthRequest, res: Response): void => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        res.status(400).json({ success: false, error: '"enabled" (boolean) is required' });
        return;
    }
    const db = getDb();
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('registration_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(enabled ? '1' : '0');
    res.json({ success: true, data: { registrationEnabled: enabled } });
});

// ─── Config Management ──────────────────────────

/** GET /api/admin/config – Read the full config (mask secrets) */
router.get('/config', (_req: AuthRequest, res: Response): void => {
    const configPath = path.resolve(__dirname, '../../../config.json');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Mask sensitive values
    if (raw.auth?.jwtSecret) raw.auth.jwtSecret = raw.auth.jwtSecret.substring(0, 4) + '••••••';
    if (raw.smtp?.password) raw.smtp.password = '••••••';
    if (raw.auth?.authentik?.clientSecret) raw.auth.authentik.clientSecret = '••••••';
    res.json({ success: true, data: raw });
});

/** PUT /api/admin/config – Save config sections */
router.put('/config', (req: AuthRequest, res: Response): void => {
    const configPath = path.resolve(__dirname, '../../../config.json');
    const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const updates = req.body;

    // Deep merge only known top-level keys, skip masked values
    if (updates.appName !== undefined) existing.appName = updates.appName;

    if (updates.server) {
        if (updates.server.port !== undefined) existing.server.port = Number(updates.server.port);
        if (updates.server.host !== undefined) existing.server.host = updates.server.host;
    }

    if (updates.udp) {
        if (updates.udp.port !== undefined) existing.udp.port = Number(updates.udp.port);
        if (updates.udp.enabled !== undefined) existing.udp.enabled = updates.udp.enabled;
    }

    if (updates.auth) {
        // Only update jwtSecret if it doesn't contain mask characters
        if (updates.auth.jwtSecret && !updates.auth.jwtSecret.includes('••')) {
            existing.auth.jwtSecret = updates.auth.jwtSecret;
        }
        if (updates.auth.tokenExpiry !== undefined) existing.auth.tokenExpiry = updates.auth.tokenExpiry;
        if (updates.auth.authelia) {
            if (updates.auth.authelia.enabled !== undefined) existing.auth.authelia.enabled = updates.auth.authelia.enabled;
            if (updates.auth.authelia.url !== undefined) existing.auth.authelia.url = updates.auth.authelia.url;
        }
        if (updates.auth.authentik) {
            if (!existing.auth.authentik) existing.auth.authentik = { enabled: false, issuer: '', clientId: '', clientSecret: '', redirectUri: '' };
            if (updates.auth.authentik.enabled !== undefined) existing.auth.authentik.enabled = updates.auth.authentik.enabled;
            if (updates.auth.authentik.issuer !== undefined) existing.auth.authentik.issuer = updates.auth.authentik.issuer;
            if (updates.auth.authentik.clientId !== undefined) existing.auth.authentik.clientId = updates.auth.authentik.clientId;
            if (updates.auth.authentik.clientSecret && !updates.auth.authentik.clientSecret.includes('••')) {
                existing.auth.authentik.clientSecret = updates.auth.authentik.clientSecret;
            }
            if (updates.auth.authentik.redirectUri !== undefined) existing.auth.authentik.redirectUri = updates.auth.authentik.redirectUri;
        }
    }

    if (updates.database) {
        if (updates.database.sqlite?.path !== undefined) existing.database.sqlite.path = updates.database.sqlite.path;
    }

    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
    reloadConfig();

    // Mask secrets for response
    const resp = JSON.parse(JSON.stringify(existing));
    if (resp.auth?.jwtSecret) resp.auth.jwtSecret = resp.auth.jwtSecret.substring(0, 4) + '••••••';
    if (resp.smtp?.password) resp.smtp.password = '••••••';
    if (resp.auth?.authentik?.clientSecret) resp.auth.authentik.clientSecret = '••••••';
    res.json({ success: true, data: resp });
});

// ─── System Reset ───────────────────────────────

/** POST /api/admin/reset – Reset entire system (delete all data) */
router.post('/reset', (req: AuthRequest, res: Response): void => {
    const { confirm } = req.body;
    if (confirm !== 'RESET') {
        res.status(400).json({ success: false, error: 'Confirmation required: send { "confirm": "RESET" }' });
        return;
    }

    try {
        const db = getDb();

        // Drop all tables
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
        for (const { name } of tables) {
            db.exec(`DROP TABLE IF EXISTS "${name}"`);
        }

        // Clear uploads directory
        const uploadsDir = path.resolve(__dirname, '../../uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            for (const file of files) {
                const filePath = path.join(uploadsDir, file);
                if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
            }
        }

        // Re-run migrations (creates tables + default admin user)
        runMigrations();

        res.json({ success: true, message: 'System has been reset successfully.' });
    } catch (err) {
        console.error('Reset error:', err);
        res.status(500).json({ success: false, error: 'Reset failed' });
    }
});

// ─── Permission Management ──────────────────────

/** GET /api/admin/vehicles – List ALL vehicles (for permission assignment) */
router.get('/vehicles', (_req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicles = db.prepare(`
        SELECT v.id, v.license_plate, v.brand, v.model, v.user_id, u.username as owner_username
        FROM vehicles v
        JOIN users u ON v.user_id = u.id
        ORDER BY u.username, v.license_plate
    `).all();
    res.json({ success: true, data: vehicles });
});

/** GET /api/admin/permissions/:userId – Get all permissions for a user */
router.get('/permissions/:userId', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const perms = db.prepare('SELECT * FROM vehicle_permissions WHERE user_id = ?').all(req.params.userId);
    res.json({ success: true, data: perms });
});

/** PUT /api/admin/permissions – Set permission for a user on a vehicle */
router.put('/permissions', (req: AuthRequest, res: Response): void => {
    const { userId, vehicleId, canView, canEdit } = req.body;
    if (!userId || !vehicleId) {
        res.status(400).json({ success: false, error: 'userId and vehicleId are required' });
        return;
    }

    const db = getDb();

    if (!canView && !canEdit) {
        // Remove permission entirely
        db.prepare('DELETE FROM vehicle_permissions WHERE user_id = ? AND vehicle_id = ?').run(userId, vehicleId);
    } else {
        // Upsert permission
        db.prepare(`
            INSERT INTO vehicle_permissions (user_id, vehicle_id, can_view, can_edit)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, vehicle_id) DO UPDATE SET can_view = excluded.can_view, can_edit = excluded.can_edit
        `).run(userId, vehicleId, canView ? 1 : 0, canEdit ? 1 : 0);
    }

    const perms = db.prepare('SELECT * FROM vehicle_permissions WHERE user_id = ?').all(userId);
    res.json({ success: true, data: perms });
});

/** GET /api/admin/permissions – Get ALL permissions (for overview) */
router.get('/permissions', (_req: AuthRequest, res: Response): void => {
    const db = getDb();
    const perms = db.prepare(`
        SELECT vp.*, u.username, v.license_plate, v.brand, v.model
        FROM vehicle_permissions vp
        JOIN users u ON vp.user_id = u.id
        JOIN vehicles v ON vp.vehicle_id = v.id
        ORDER BY u.username, v.license_plate
    `).all();
    res.json({ success: true, data: perms });
});

export default router;
