import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, '../../config.json');

export interface DatabaseConfig {
    type: 'sqlite';
    sqlite: { path: string };
}

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
    name?: string;
    picture?: string;
}

export interface AuthentikConfig {
    enabled: boolean;
    issuer: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface AppConfig {
    appName: string;
    database: DatabaseConfig;
    smtp: SmtpConfig;
    udp: { port: number; enabled: boolean };
    auth: {
        jwtSecret: string;
        tokenExpiry: string;
        authelia: { enabled: boolean; url: string };
        authentik: AuthentikConfig;
    };
    server: { port: number; host: string };
}

function loadConfig(): AppConfig {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as AppConfig;
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
    if (!_config) _config = loadConfig();
    return _config;
}

export function reloadConfig(): AppConfig {
    _config = loadConfig();
    return _config;
}
