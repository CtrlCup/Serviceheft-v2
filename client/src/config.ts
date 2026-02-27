// ──────────────────────────────────────
// Frontend Configuration
// ──────────────────────────────────────

const config = {
    appName: 'Digitales Serviceheft',
    // In production (served by Express), use relative URL (empty string).
    // In development, Vite proxy forwards /api and /ws to the server.
    apiUrl: import.meta.env.VITE_API_URL || '',
    wsUrl: import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/live`,
};

export default config;
