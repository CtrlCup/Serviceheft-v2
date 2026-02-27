import { Router, Response } from 'express';
import { getDb } from '../database/connection.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

/** GET /api/vehicles/:vehicleId/maintenance – List records */
router.get('/:vehicleId/maintenance', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    // Verify ownership
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.vehicleId, req.userId!) as any;
    if (!vehicle) { res.status(404).json({ success: false, error: 'Vehicle not found' }); return; }

    const records = db.prepare(
        'SELECT * FROM maintenance_records WHERE vehicle_id = ? ORDER BY date DESC, created_at DESC'
    ).all(req.params.vehicleId);
    res.json({ success: true, data: records });
});

const recalculateVehicleStats = (db: any, vehicleId: number | string) => {
    const stats = db.prepare(`
        SELECT 
            MAX(mileage) as max_mileage,
            SUM(cost) as total_cost
        FROM maintenance_records 
        WHERE vehicle_id = ?
    `).get(vehicleId) as { max_mileage: number; total_cost: number };

    db.prepare(`
        UPDATE vehicles 
        SET 
            mileage = MAX(mileage, ?),
            total_expenses = ?
        WHERE id = ?
    `).run(stats.max_mileage || 0, stats.total_cost || 0, vehicleId);
};

// ─── Create / Update / Delete Routes ───

/** POST /api/vehicles/:vehicleId/maintenance – Create record */
router.post('/:vehicleId/maintenance', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.vehicleId, req.userId!) as any;
    if (!vehicle) { res.status(404).json({ success: false, error: 'Vehicle not found' }); return; }

    const {
        type, title = '', description = '', date = '', mileage = 0, cost = 0,
        fuelAmount, fuelPricePerLiter, fuelType,
        intervalDays, intervalKm, intervalEngineHours
    } = req.body;

    if (!type) {
        res.status(400).json({ success: false, error: 'Type is required' });
        return;
    }

    const result = db.prepare(`
    INSERT INTO maintenance_records (vehicle_id, type, title, description, date, mileage, cost,
      fuel_amount, fuel_price_per_liter, fuel_type, interval_days, interval_km, interval_engine_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        req.params.vehicleId, type, title, description, date, mileage, cost,
        fuelAmount ?? null, fuelPricePerLiter ?? null, fuelType ?? null,
        intervalDays ?? null, intervalKm ?? null, intervalEngineHours ?? null
    );

    recalculateVehicleStats(db, Number(req.params.vehicleId));

    const record = db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: record });
});

/** PUT /api/vehicles/:vehicleId/maintenance/:id – Update record */
router.put('/:vehicleId/maintenance/:id', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.vehicleId, req.userId!) as any;
    if (!vehicle) { res.status(404).json({ success: false, error: 'Vehicle not found' }); return; }

    const record = db.prepare('SELECT * FROM maintenance_records WHERE id = ? AND vehicle_id = ?').get(req.params.id, req.params.vehicleId) as any;
    if (!record) { res.status(404).json({ success: false, error: 'Record not found' }); return; }

    const keyMap: Record<string, string> = {
        type: 'type', title: 'title', description: 'description', date: 'date',
        mileage: 'mileage', cost: 'cost', fuelAmount: 'fuel_amount',
        fuelPricePerLiter: 'fuel_price_per_liter', fuelType: 'fuel_type',
        intervalDays: 'interval_days', intervalKm: 'interval_km',
        intervalEngineHours: 'interval_engine_hours'
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
        db.prepare(`UPDATE maintenance_records SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        recalculateVehicleStats(db, Number(req.params.vehicleId));
    }

    const updated = db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});

/** DELETE /api/vehicles/:vehicleId/maintenance/:id */
router.delete('/:vehicleId/maintenance/:id', (req: AuthRequest, res: Response): void => {
    const db = getDb();
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.vehicleId, req.userId!) as any;
    if (!vehicle) { res.status(404).json({ success: false, error: 'Vehicle not found' }); return; }

    const record = db.prepare('SELECT id FROM maintenance_records WHERE id = ? AND vehicle_id = ?').get(req.params.id, req.params.vehicleId) as any;
    if (!record) { res.status(404).json({ success: false, error: 'Record not found' }); return; }

    db.prepare('DELETE FROM maintenance_records WHERE id = ?').run(req.params.id);
    recalculateVehicleStats(db, Number(req.params.vehicleId));

    res.json({ success: true });
});

export default router;
