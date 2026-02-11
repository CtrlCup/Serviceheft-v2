import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config.js';
import { getDb } from '../database/connection.js';

export interface AuthRequest extends Request {
    userId?: number;
    userRole?: string;
}

/**
 * JWT authentication middleware.
 * Extracts token from Authorization header or cookie.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
    const config = getConfig();

    // Check Authelia header first
    if (config.auth.authelia.enabled) {
        const remoteUser = req.headers['remote-user'] as string;
        if (remoteUser) {
            const db = getDb();
            const user = db.prepare('SELECT id, role FROM users WHERE username = ?').get(remoteUser) as any;
            if (user) {
                req.userId = user.id;
                req.userRole = user.role;
                next();
                return;
            }
        }
    }

    // JWT from header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (req.cookies?.token as string);

    if (!token) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
    }

    try {
        const decoded = jwt.verify(token, config.auth.jwtSecret) as { userId: number; role: string };
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        next();
    } catch {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

/**
 * Admin-only middleware. Must be used after authMiddleware.
 */
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
    if (req.userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
    }
    next();
}
