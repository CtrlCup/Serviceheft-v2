import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getDb } from '../database/connection.js';
import { getConfig } from '../config.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

/** Helper: format user for response */
function formatUser(user: any) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        notificationsEnabled: !!user.notifications_enabled,
        avatar: user.avatar || '',
        mustChangePassword: !!user.must_change_password,
    };
}

/** POST /api/auth/login */
router.post('/login', (req: AuthRequest, res: Response): void => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ success: false, error: 'Username and password required' });
        return;
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
    }

    const config = getConfig();
    const token = jwt.sign(
        { userId: user.id, role: user.role },
        config.auth.jwtSecret,
        { expiresIn: config.auth.tokenExpiry as string & jwt.SignOptions['expiresIn'] }
    );

    res.json({ success: true, data: { token, user: formatUser(user) } });
});

/** POST /api/auth/register – Public registration (if enabled) */
router.post('/register', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'registration_enabled'").get() as any;
    if (!setting || setting.value !== '1') {
        res.status(403).json({ success: false, error: 'Registrierung ist deaktiviert' });
        return;
    }

    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        res.status(400).json({ success: false, error: 'Username, E-Mail und Passwort erforderlich' });
        return;
    }
    if (password.length < 6) {
        res.status(400).json({ success: false, error: 'Passwort muss mindestens 6 Zeichen lang sein' });
        return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        res.status(409).json({ success: false, error: 'Benutzername bereits vergeben' });
        return;
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(username, email, hash, 'user');

    const config = getConfig();
    const token = jwt.sign(
        { userId: result.lastInsertRowid, role: 'user' },
        config.auth.jwtSecret,
        { expiresIn: config.auth.tokenExpiry as string & jwt.SignOptions['expiresIn'] }
    );

    res.status(201).json({
        success: true,
        data: {
            token,
            user: {
                id: result.lastInsertRowid,
                username,
                email,
                role: 'user',
                notificationsEnabled: true,
                avatar: '',
                mustChangePassword: false,
            },
        },
    });
});

/** POST /api/auth/logout */
router.post('/logout', (_req: AuthRequest, res: Response): void => {
    res.json({ success: true });
});

/** GET /api/auth/me */
router.get('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const user = db.prepare('SELECT id, username, email, role, notifications_enabled, avatar, must_change_password FROM users WHERE id = ?').get(req.userId!) as any;
    if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
    }
    res.json({ success: true, data: formatUser(user) });
});

/** GET /api/auth/registration-status – Public: check registration + SSO config */
router.get('/registration-status', (_req: Request, res: Response): void => {
    const db = getDb();
    const config = getConfig();
    const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'registration_enabled'").get() as any;
    res.json({
        success: true,
        data: {
            registrationEnabled: setting?.value === '1',
            autheliaEnabled: config.auth.authelia?.enabled ?? false,
            autheliaUrl: config.auth.authelia?.url ?? '',
            authentikEnabled: config.auth.authentik?.enabled ?? false,
            authentikIssuer: config.auth.authentik?.issuer ?? '',
            authentikClientId: config.auth.authentik?.clientId ?? '',
            authentikRedirectUri: config.auth.authentik?.redirectUri ?? '',
        },
    });
});

// ─── Passkey Authentication (simplified, matching the existing stub) ─────

// In-memory challenge store (TTL 5 min)
const passkeyChallengStore = new Map<string, { challenge: string; expires: number }>();

/** POST /api/auth/passkey-challenge – Generate challenge for WebAuthn */
router.post('/passkey-challenge', (_req: Request, res: Response): void => {
    const challenge = crypto.randomBytes(32).toString('base64url');
    const id = crypto.randomBytes(16).toString('hex');
    passkeyChallengStore.set(id, { challenge, expires: Date.now() + 5 * 60 * 1000 });

    // Clean expired entries
    for (const [key, val] of passkeyChallengStore) {
        if (val.expires < Date.now()) passkeyChallengStore.delete(key);
    }

    res.json({ success: true, data: { challengeId: id, challenge } });
});

/** POST /api/auth/passkey-login – Authenticate with a stored passkey */
router.post('/passkey-login', (req: Request, res: Response): void => {
    const { credentialId, challengeId } = req.body;
    if (!credentialId || !challengeId) {
        res.status(400).json({ success: false, error: 'credentialId and challengeId are required' });
        return;
    }

    // Verify challenge exists and is not expired
    const stored = passkeyChallengStore.get(challengeId);
    if (!stored || stored.expires < Date.now()) {
        res.status(400).json({ success: false, error: 'Challenge abgelaufen oder ungültig' });
        return;
    }
    passkeyChallengStore.delete(challengeId);

    // Look up passkey credential
    const db = getDb();
    const credential = db.prepare('SELECT * FROM passkey_credentials WHERE id = ?').get(credentialId) as any;
    if (!credential) {
        res.status(401).json({ success: false, error: 'Passkey nicht gefunden' });
        return;
    }

    // Get the user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(credential.user_id) as any;
    if (!user) {
        res.status(401).json({ success: false, error: 'Benutzer nicht gefunden' });
        return;
    }

    // Update counter
    db.prepare('UPDATE passkey_credentials SET counter = counter + 1 WHERE id = ?').run(credentialId);

    // Issue JWT
    const config = getConfig();
    const token = jwt.sign(
        { userId: user.id, role: user.role },
        config.auth.jwtSecret,
        { expiresIn: config.auth.tokenExpiry as string & jwt.SignOptions['expiresIn'] }
    );

    res.json({ success: true, data: { token, user: formatUser(user) } });
});

// ─── Password Reset via E-Mail ──────────────────

/** POST /api/auth/forgot-password */
router.post('/forgot-password', (req: Request, res: Response): void => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ success: false, error: 'E-Mail ist erforderlich' });
        return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id, username FROM users WHERE email = ?').get(email) as any;

    // Always return success (don't reveal if email exists)
    if (!user) {
        res.json({ success: true, data: { message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link gesendet.' } });
        return;
    }

    // Check SMTP config
    const config = getConfig();
    if (!config.smtp?.host) {
        res.status(500).json({ success: false, error: 'E-Mail-Dienst ist nicht konfiguriert' });
        return;
    }

    // Generate reset token (valid 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // Invalidate all previous tokens for this user
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?').run(user.id);
    db.prepare(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, token, expiresAt);

    // Send email
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
    const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.password },
    });

    transporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject: 'Passwort zurücksetzen – Digitales Serviceheft',
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h2>Passwort zurücksetzen</h2>
                <p>Hallo <strong>${user.username}</strong>,</p>
                <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
                <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;">Passwort zurücksetzen</a></p>
                <p style="color:#888;font-size:0.875rem;">Dieser Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
            </div>
        `,
    }).catch(err => console.error('Failed to send reset email:', err));

    res.json({ success: true, data: { message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link gesendet.' } });
});

/** POST /api/auth/reset-password */
router.post('/reset-password', (req: Request, res: Response): void => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        res.status(400).json({ success: false, error: 'Token und neues Passwort erforderlich' });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ success: false, error: 'Passwort muss mindestens 6 Zeichen lang sein' });
        return;
    }

    const db = getDb();
    const resetToken = db.prepare(
        'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0'
    ).get(token) as any;

    if (!resetToken) {
        res.status(400).json({ success: false, error: 'Ungültiger oder abgelaufener Token' });
        return;
    }

    if (new Date(resetToken.expires_at) < new Date()) {
        db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);
        res.status(400).json({ success: false, error: 'Token ist abgelaufen' });
        return;
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, resetToken.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);

    res.json({ success: true, data: { message: 'Passwort erfolgreich zurückgesetzt' } });
});

export default router;
