import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

import { getConfig } from './config.js';
import { getDb } from './database/connection.js';
import { runMigrations } from './database/migrations.js';
import { authMiddleware, adminMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import maintenanceRoutes from './routes/maintenance.js';
import adminRoutes from './routes/admin.js';
import settingsRoutes from './routes/settings.js';
import shareRoutes, { publicShareRouter } from './routes/shares.js';
import { startUdpListener } from './udp/listener.js';
import { initWebSocket } from './websocket/liveStatus.js';
import { startNotificationScheduler } from './services/notificationService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = getConfig();
const app = express();

// ─── Middleware ──────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files (uploaded vehicle images) ─────
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// ─── API Routes ─────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', authMiddleware, vehicleRoutes);
app.use('/api/vehicles', authMiddleware, maintenanceRoutes);
app.use('/api/admin', authMiddleware, adminMiddleware, adminRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/vehicles', authMiddleware, shareRoutes);  // Share management (authenticated)
app.use('/api/shared', publicShareRouter);               // Public share access (no auth)

// ─── Serve client build in production ───────────
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

// ─── Start server ───────────────────────────────
console.log('\n🚗 Digitales Serviceheft Server');
console.log('─'.repeat(40));

// Database
getDb();
runMigrations();
console.log(`  ✓ Database (${config.database.type}) ready`);

// HTTP + WebSocket
const server = createServer(app);
initWebSocket(server);

server.listen(config.server.port, config.server.host, () => {
    console.log(`  ✓ Server on http://${config.server.host}:${config.server.port}`);
});

// UDP
startUdpListener();

// Notifications
startNotificationScheduler();

console.log('─'.repeat(40));
console.log('  Ready!\n');
