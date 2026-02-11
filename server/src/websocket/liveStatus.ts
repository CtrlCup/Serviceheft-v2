import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

interface LiveClient {
    ws: WebSocket;
    vehicleIds: Set<number>;
}

const clients: LiveClient[] = [];
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server attached to the HTTP server.
 * Clients connect and send { subscribe: [vehicleId1, vehicleId2, ...] }
 */
export function initWebSocket(server: Server): void {
    wss = new WebSocketServer({ server, path: '/ws/live' });

    wss.on('connection', (ws) => {
        const client: LiveClient = { ws, vehicleIds: new Set() };
        clients.push(client);

        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.subscribe && Array.isArray(msg.subscribe)) {
                    client.vehicleIds = new Set(msg.subscribe.map(Number));
                }
            } catch { /* ignore invalid messages */ }
        });

        ws.on('close', () => {
            const idx = clients.indexOf(client);
            if (idx !== -1) clients.splice(idx, 1);
        });
    });

    console.log('  ✓ WebSocket server on /ws/live');
}

/**
 * Broadcast live data update to all clients subscribed to a specific vehicle.
 */
export function broadcast(vehicleId: number, data: any): void {
    const payload = JSON.stringify({ type: 'live-update', ...data });
    for (const client of clients) {
        if (client.vehicleIds.has(vehicleId) && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(payload);
        }
    }
}
