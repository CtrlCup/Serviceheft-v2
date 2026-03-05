import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../database/connection.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── Authenticated Routes (require auth) ────────

/**
 * POST /api/vehicles/:id/shares – Create a new share link
 * Body: { label?, expiresAt?, password? }
 */
router.post('/:id/shares', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicleId = Number(req.params.id);

    // Verify ownership
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(vehicleId, req.userId!) as any;
    if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }

    const { label = '', expiresAt, password } = req.body;
    const shareToken = crypto.randomBytes(24).toString('base64url');
    const passwordHash = password ? bcrypt.hashSync(password, 10) : null;

    db.prepare(`
        INSERT INTO vehicle_shares (vehicle_id, share_token, password_hash, expires_at, label, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(vehicleId, shareToken, passwordHash, expiresAt || null, label, req.userId!);

    const share = db.prepare('SELECT * FROM vehicle_shares WHERE share_token = ?').get(shareToken) as any;

    res.status(201).json({
        success: true,
        data: {
            ...share,
            password_hash: undefined, // Don't expose hash
            hasPassword: !!share.password_hash,
            shareUrl: `/shared/${shareToken}`,
        },
    });
});

/**
 * GET /api/vehicles/:id/shares – List all shares for a vehicle
 */
router.get('/:id/shares', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicleId = Number(req.params.id);

    // Verify ownership
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(vehicleId, req.userId!) as any;
    if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }

    const shares = db.prepare('SELECT * FROM vehicle_shares WHERE vehicle_id = ? ORDER BY created_at DESC').all(vehicleId) as any[];
    const sanitized = shares.map(s => ({
        ...s,
        password_hash: undefined,
        hasPassword: !!s.password_hash,
        shareUrl: `/shared/${s.share_token}`,
    }));

    res.json({ success: true, data: sanitized });
});

/**
 * DELETE /api/vehicles/:id/shares/:shareId – Revoke a share
 */
router.delete('/:id/shares/:shareId', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicleId = Number(req.params.id);
    const shareId = Number(req.params.shareId);

    // Verify ownership
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(vehicleId, req.userId!) as any;
    if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }

    db.prepare('DELETE FROM vehicle_shares WHERE id = ? AND vehicle_id = ?').run(shareId, vehicleId);
    res.json({ success: true });
});

export default router;

// ─── Public Share Routes (no auth required) ─────
// These are mounted separately in index.ts

export const publicShareRouter = Router();

/**
 * GET /api/shared/:token – Get shared vehicle data (public)
 * Query: ?password=xxx (if share is password-protected)
 */
publicShareRouter.get('/:token', (req: Request, res: Response): void => {
    const db = getDb();
    const { token } = req.params;

    const share = db.prepare('SELECT * FROM vehicle_shares WHERE share_token = ?').get(token) as any;
    if (!share) {
        res.status(404).json({ success: false, error: 'Share not found or expired' });
        return;
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
        res.status(410).json({ success: false, error: 'Dieser Link ist abgelaufen' });
        return;
    }

    // Check password if set
    if (share.password_hash) {
        const password = req.query.password as string || req.headers['x-share-password'] as string;
        if (!password) {
            res.json({
                success: true,
                data: { requiresPassword: true, label: share.label },
            });
            return;
        }
        if (!bcrypt.compareSync(password, share.password_hash)) {
            res.status(401).json({ success: false, error: 'Falsches Passwort' });
            return;
        }
    }

    // Get vehicle data
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(share.vehicle_id) as any;
    if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }

    // Get maintenance records
    const records = db.prepare(
        'SELECT * FROM maintenance_records WHERE vehicle_id = ? ORDER BY date DESC'
    ).all(share.vehicle_id);

    // Sanitize – don't expose UDP token or internal IDs
    const { udp_token, user_id, ...safeVehicle } = vehicle;

    res.json({
        success: true,
        data: {
            vehicle: safeVehicle,
            records,
            label: share.label,
        },
    });
});

/**
 * POST /api/shared/:token/verify – Verify share password
 * Body: { password }
 */
publicShareRouter.post('/:token/verify', (req: Request, res: Response): void => {
    const db = getDb();
    const { token } = req.params;
    const { password } = req.body;

    const share = db.prepare('SELECT * FROM vehicle_shares WHERE share_token = ?').get(token) as any;
    if (!share) {
        res.status(404).json({ success: false, error: 'Share not found' });
        return;
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
        res.status(410).json({ success: false, error: 'Dieser Link ist abgelaufen' });
        return;
    }

    if (!share.password_hash) {
        res.json({ success: true, data: { valid: true } });
        return;
    }

    const valid = bcrypt.compareSync(password || '', share.password_hash);
    if (!valid) {
        res.status(401).json({ success: false, error: 'Falsches Passwort' });
        return;
    }

    res.json({ success: true, data: { valid: true } });
});
