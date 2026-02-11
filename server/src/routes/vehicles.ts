import { Router, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDb } from '../database/connection.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── Multer Upload Config ─────────────────────────
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `vehicle-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        cb(null, allowed.includes(file.mimetype));
    },
});

/** GET /api/vehicles – List user's vehicles */
router.get('/', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC').all(req.userId!);
    res.json({ success: true, data: vehicles });
});

/** GET /api/vehicles/:id – Get single vehicle */
router.get('/:id', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as any;
    if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }
    res.json({ success: true, data: vehicle });
});

/** POST /api/vehicles – Create vehicle */
router.post('/', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const {
        licensePlate = '', brand = '', model = '', year = 0, color = '',
        vin = '', hsn = '', tsn = '', mileage = 0, purchaseDate = '',
        purchasePrice = 0, nextTuevDate = '', imagePath = ''
    } = req.body;

    const udpToken = crypto.randomBytes(16).toString('hex');

    const result = db.prepare(`
    INSERT INTO vehicles (user_id, license_plate, brand, model, year, color, vin, hsn, tsn,
      mileage, purchase_date, purchase_price, next_tuev_date, image_path, udp_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        req.userId!, licensePlate, brand, model, year, color, vin, hsn, tsn,
        mileage, purchaseDate, purchasePrice, nextTuevDate, imagePath, udpToken
    );

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: vehicle });
});

/** PUT /api/vehicles/:id – Update vehicle */
router.put('/:id', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as any;
    if (!existing) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }

    const keyMap: Record<string, string> = {
        licensePlate: 'license_plate', brand: 'brand', model: 'model', year: 'year',
        color: 'color', vin: 'vin', hsn: 'hsn', tsn: 'tsn', mileage: 'mileage',
        purchaseDate: 'purchase_date', purchasePrice: 'purchase_price',
        totalExpenses: 'total_expenses', nextTuevDate: 'next_tuev_date',
        imagePath: 'image_path', udpToken: 'udp_token'
    };

    const updates: string[] = [];
    const values: any[] = [];

    for (const [camelKey, snakeKey] of Object.entries(keyMap)) {
        if (req.body[camelKey] !== undefined) {
            updates.push(`${snakeKey} = ?`);
            values.push(req.body[camelKey]);
        }
    }

    if (updates.length > 0) {
        values.push(req.params.id);
        db.prepare(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: vehicle });
});

/** DELETE /api/vehicles/:id */
router.delete('/:id', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const existing = db.prepare('SELECT id, image_path FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as any;
    if (!existing) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }

    // Delete associated image file
    if (existing.image_path) {
        const imgPath = path.resolve(uploadsDir, path.basename(existing.image_path));
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    db.prepare('DELETE FROM maintenance_records WHERE vehicle_id = ?').run(req.params.id);
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

/** GET /api/vehicles/:id/live-status */
router.get('/:id/live-status', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicle = db.prepare(
        'SELECT engine_status, engine_runtime, mileage, fuel_level, last_seen FROM vehicles WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.userId!) as any;
    if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }
    res.json({ success: true, data: vehicle });
});

// ─── Vehicle Image Upload / Delete ───────────────

/** POST /api/vehicles/:id/image – Upload vehicle image */
router.post('/:id/image', upload.single('image'), (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const existing = db.prepare('SELECT id, image_path FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as any;
    if (!existing) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }

    if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file provided' });
        return;
    }

    // Delete old image if exists
    if (existing.image_path) {
        const oldPath = path.resolve(uploadsDir, path.basename(existing.image_path));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const imagePath = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE vehicles SET image_path = ? WHERE id = ?').run(imagePath, req.params.id);
    res.json({ success: true, data: { imagePath } });
});

/** DELETE /api/vehicles/:id/image – Delete vehicle image */
router.delete('/:id/image', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const existing = db.prepare('SELECT id, image_path FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as any;
    if (!existing) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
    }

    if (existing.image_path) {
        const imgPath = path.resolve(uploadsDir, path.basename(existing.image_path));
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    db.prepare('UPDATE vehicles SET image_path = ? WHERE id = ?').run('', req.params.id);
    res.json({ success: true });
});

export default router;
