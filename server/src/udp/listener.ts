import dgram from 'dgram';
import { getDb } from '../database/connection.js';
import { getConfig } from '../config.js';
import { broadcast } from '../websocket/liveStatus.js';

/**
 * Start UDP listener for live vehicle data ingestion.
 * Accepts JSON payloads:
 * { vehicleToken, km?, fuelLevel?, fuelStop?, engineStatus?, engineRuntime? }
 */
export function startUdpListener(): void {
    const config = getConfig();
    if (!config.udp.enabled) {
        console.log('  ⊘ UDP listener disabled in config');
        return;
    }

    const server = dgram.createSocket('udp4');

    server.on('message', (msg, rinfo) => {
        try {
            const data = JSON.parse(msg.toString());
            if (!data.vehicleToken) {
                console.warn(`UDP: Missing vehicleToken from ${rinfo.address}:${rinfo.port}`);
                return;
            }

            const db = getDb();
            const vehicle = db.prepare('SELECT id, user_id FROM vehicles WHERE udp_token = ?').get(data.vehicleToken) as any;

            if (!vehicle) {
                console.warn(`UDP: Unknown vehicleToken "${data.vehicleToken}" from ${rinfo.address}`);
                return;
            }

            const updates: string[] = [];
            const values: any[] = [];
            const now = new Date().toISOString();

            if (data.km !== undefined) {
                updates.push('mileage = MAX(mileage, ?)');
                values.push(data.km);
            }
            if (data.fuelLevel !== undefined) {
                updates.push('fuel_level = ?');
                values.push(data.fuelLevel);
            }
            if (data.engineStatus !== undefined) {
                updates.push('engine_status = ?');
                values.push(data.engineStatus);
            }
            if (data.engineRuntime !== undefined) {
                updates.push('engine_runtime = MAX(engine_runtime, ?)');
                values.push(data.engineRuntime);
            }

            updates.push('last_seen = ?');
            values.push(now);
            values.push(vehicle.id);

            db.prepare(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`).run(...values);

            // Auto-create fuel stop record if fuelStop data is present
            if (data.fuelStop) {
                db.prepare(`
          INSERT INTO maintenance_records (vehicle_id, type, title, date, mileage, cost, fuel_amount, fuel_price_per_liter, fuel_type)
          VALUES (?, 'fuel_stop', 'Tankstop (Auto)', ?, ?, ?, ?, ?, ?)
        `).run(
                    vehicle.id, now.slice(0, 10), data.km ?? 0,
                    (data.fuelStop.liters || 0) * (data.fuelStop.pricePerLiter || 0),
                    data.fuelStop.liters, data.fuelStop.pricePerLiter, data.fuelStop.fuelType || ''
                );
            }

            // Broadcast live update to connected WebSocket clients
            broadcast(vehicle.id, {
                vehicleId: vehicle.id,
                mileage: data.km,
                fuelLevel: data.fuelLevel,
                engineStatus: data.engineStatus,
                engineRuntime: data.engineRuntime,
                lastSeen: now,
            });

        } catch (err) {
            console.error('UDP parse error:', err);
        }
    });

    server.on('listening', () => {
        console.log(`  ✓ UDP listener on port ${config.udp.port}`);
    });

    server.bind(config.udp.port);
}
