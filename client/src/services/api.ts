import config from '../config';
import type { Vehicle, MaintenanceRecord, User, NotificationInterval } from '../types';

// ──────────────────────────────────────
// API Client
// ──────────────────────────────────────

function getToken(): string | null {
    return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${config.apiUrl}${path}`, {
        ...options,
        headers,
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'API request failed');
    return json.data;
}

// ─── Auth ───────────────────────────────────────
export const api = {
    auth: {
        login: (username: string, password: string) =>
            request<{ token: string; user: User }>('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            }),
        register: (username: string, email: string, password: string) =>
            request<{ token: string; user: User }>('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password }),
            }),
        registrationStatus: () =>
            request<{ registrationEnabled: boolean }>('/api/auth/registration-status'),
        forgotPassword: (email: string) =>
            request<{ message: string }>('/api/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            }),
        resetPassword: (token: string, newPassword: string) =>
            request<{ message: string }>('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, newPassword }),
            }),
        me: () => request<User>('/api/auth/me'),
        logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
    },

    // ─── Vehicles ─────────────────────────────────
    vehicles: {
        list: () => request<Vehicle[]>('/api/vehicles'),
        get: (id: number) => request<Vehicle>(`/api/vehicles/${id}`),
        create: (data: Partial<Vehicle>) =>
            request<Vehicle>('/api/vehicles', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: number, data: Partial<Vehicle>) =>
            request<Vehicle>(`/api/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: number) =>
            request<void>(`/api/vehicles/${id}`, { method: 'DELETE' }),
        liveStatus: (id: number) =>
            request<any>(`/api/vehicles/${id}/live-status`),
        uploadImage: async (id: number, file: File): Promise<{ imagePath: string }> => {
            const form = new FormData();
            form.append('image', file);
            const resp = await fetch(`${config.apiUrl}/api/vehicles/${id}/image`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: form,
            });
            const json = await resp.json();
            if (!resp.ok) throw new Error(json.error || 'Upload fehlgeschlagen');
            return json.data;
        },
        deleteImage: (id: number) =>
            request<void>(`/api/vehicles/${id}/image`, { method: 'DELETE' }),
    },

    // ─── Maintenance ──────────────────────────────
    maintenance: {
        list: (vehicleId: number) =>
            request<MaintenanceRecord[]>(`/api/vehicles/${vehicleId}/maintenance`),
        create: (vehicleId: number, data: Partial<MaintenanceRecord>) =>
            request<MaintenanceRecord>(`/api/vehicles/${vehicleId}/maintenance`, {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        update: (vehicleId: number, id: number, data: Partial<MaintenanceRecord>) =>
            request<MaintenanceRecord>(`/api/vehicles/${vehicleId}/maintenance/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        delete: (vehicleId: number, id: number) =>
            request<void>(`/api/vehicles/${vehicleId}/maintenance/${id}`, { method: 'DELETE' }),
    },

    // ─── Settings ─────────────────────────────────
    settings: {
        toggleNotifications: (enabled: boolean) =>
            request<{ notificationsEnabled: boolean }>('/api/settings/notifications', {
                method: 'PUT',
                body: JSON.stringify({ enabled }),
            }),
        updateProfile: (data: { username?: string; email?: string; currentPassword?: string; newPassword?: string }) =>
            request<User>('/api/settings/profile', {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        getPasskeys: () => request<any[]>('/api/settings/passkeys'),
        registerPasskey: (data: { credentialId: string; publicKey: string; deviceName?: string }) =>
            request<any[]>('/api/settings/passkeys', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        deletePasskey: (id: string) =>
            request<void>(`/api/settings/passkeys/${id}`, { method: 'DELETE' }),
        uploadAvatar: async (file: File): Promise<{ avatar: string }> => {
            const form = new FormData();
            form.append('avatar', file);
            const resp = await fetch(`${config.apiUrl}/api/settings/avatar`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: form,
            });
            const json = await resp.json();
            if (!resp.ok) throw new Error(json.error || 'Upload fehlgeschlagen');
            return json.data;
        },
        deleteAvatar: () =>
            request<{ avatar: string }>('/api/settings/avatar', { method: 'DELETE' }),
        getIntervals: (vehicleId: number) =>
            request<NotificationInterval[]>(`/api/settings/intervals/${vehicleId}`),
        setInterval: (vehicleId: number, data: Partial<NotificationInterval>) =>
            request<NotificationInterval[]>(`/api/settings/intervals/${vehicleId}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
    },

    // ─── Admin ────────────────────────────────────
    admin: {
        getUsers: () => request<any[]>('/api/admin/users'),
        createUser: (data: { username: string; email: string; password: string; role: string }) =>
            request<any>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
        updateUser: (id: number, data: any) =>
            request<any>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteUser: (id: number) =>
            request<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
        getSmtp: () => request<any>('/api/admin/smtp'),
        updateSmtp: (data: any) =>
            request<any>('/api/admin/smtp', { method: 'PUT', body: JSON.stringify(data) }),
        getSystem: () => request<any>('/api/admin/system'),
        getConfig: () => request<any>('/api/admin/config'),
        updateConfig: (data: any) =>
            request<any>('/api/admin/config', { method: 'PUT', body: JSON.stringify(data) }),
        toggleRegistration: (enabled: boolean) =>
            request<{ registrationEnabled: boolean }>('/api/admin/registration', {
                method: 'PUT',
                body: JSON.stringify({ enabled }),
            }),
        resetSystem: () =>
            request<{ message: string }>('/api/admin/reset', {
                method: 'POST',
                body: JSON.stringify({ confirm: 'RESET' }),
            }),
    },
};
