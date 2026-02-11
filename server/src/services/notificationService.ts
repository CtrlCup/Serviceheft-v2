import nodemailer from 'nodemailer';
import { getDb } from '../database/connection.js';
import { getConfig } from '../config.js';

/**
 * Check all notification intervals and send email reminders
 * when thresholds are reached. Called periodically (e.g. every hour).
 */
export async function checkAndSendNotifications(): Promise<void> {
    const config = getConfig();
    if (!config.smtp.host) return; // SMTP not configured

    const db = getDb();
    const intervals = db.prepare(`
    SELECT ni.*, v.mileage, v.engine_runtime, v.license_plate, v.brand, v.model,
           u.email, u.notifications_enabled, u.username
    FROM notification_intervals ni
    JOIN vehicles v ON ni.vehicle_id = v.id
    JOIN users u ON v.user_id = u.id
    WHERE u.notifications_enabled = 1
  `).all() as any[];

    if (intervals.length === 0) return;

    const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: { user: config.smtp.user, pass: config.smtp.password },
    });

    for (const interval of intervals) {
        // Find the latest maintenance record of this type for this vehicle
        const lastRecord = db.prepare(`
      SELECT date, mileage FROM maintenance_records
      WHERE vehicle_id = ? AND type = ?
      ORDER BY date DESC LIMIT 1
    `).get(interval.vehicle_id, interval.maintenance_type) as any;

        if (!lastRecord) continue;

        let shouldNotify = false;
        const reasons: string[] = [];

        // Check time interval
        if (interval.interval_days) {
            const lastDate = new Date(lastRecord.date);
            const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince >= interval.interval_days) {
                shouldNotify = true;
                reasons.push(`${daysSince} Tage seit letzter Wartung (Limit: ${interval.interval_days})`);
            }
        }

        // Check km interval
        if (interval.interval_km) {
            const kmSince = interval.mileage - lastRecord.mileage;
            if (kmSince >= interval.interval_km) {
                shouldNotify = true;
                reasons.push(`${kmSince} km seit letzter Wartung (Limit: ${interval.interval_km})`);
            }
        }

        // Check engine hours interval
        if (interval.interval_engine_hours) {
            const engineHours = Math.floor(interval.engine_runtime / 3600);
            // We'd need to store engine hours at last maintenance to compare properly
            // For now, compare total engine hours as a simplified check
            if (engineHours >= interval.interval_engine_hours) {
                shouldNotify = true;
                reasons.push(`${engineHours}h Motorlaufzeit (Limit: ${interval.interval_engine_hours}h)`);
            }
        }

        // Check if we already notified recently (within last 24h)
        if (shouldNotify && interval.last_notified) {
            const lastNotified = new Date(interval.last_notified);
            const hoursSinceNotification = (Date.now() - lastNotified.getTime()) / (1000 * 60 * 60);
            if (hoursSinceNotification < 24) shouldNotify = false;
        }

        if (shouldNotify) {
            try {
                await transporter.sendMail({
                    from: config.smtp.from,
                    to: interval.email,
                    subject: `🔧 Wartungserinnerung: ${interval.brand} ${interval.model} (${interval.license_plate})`,
                    html: `
            <h2>Wartungserinnerung</h2>
            <p>Hallo ${interval.username},</p>
            <p>Für Ihr Fahrzeug <strong>${interval.brand} ${interval.model}</strong> (${interval.license_plate}) steht eine Wartung an:</p>
            <ul>
              <li><strong>Typ:</strong> ${interval.maintenance_type}</li>
              ${reasons.map(r => `<li>${r}</li>`).join('')}
            </ul>
            <p>Bitte planen Sie einen Termin ein.</p>
            <p>– ${config.appName}</p>
          `,
                });

                // Update last_notified
                db.prepare('UPDATE notification_intervals SET last_notified = ? WHERE id = ?')
                    .run(new Date().toISOString(), interval.id);

                console.log(`📧 Notification sent to ${interval.email} for ${interval.license_plate}`);
            } catch (err) {
                console.error(`Failed to send notification to ${interval.email}:`, err);
            }
        }
    }
}

/**
 * Start periodic notification check (every hour).
 */
export function startNotificationScheduler(): void {
    console.log('  ✓ Notification scheduler started (hourly)');
    // Run once on start, then every hour
    setTimeout(() => checkAndSendNotifications(), 10000);
    setInterval(() => checkAndSendNotifications(), 60 * 60 * 1000);
}
