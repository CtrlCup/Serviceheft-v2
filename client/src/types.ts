// ──────────────────────────────────────
// Shared TypeScript types (Frontend)
// ──────────────────────────────────────

export interface User {
    id: number;
    username: string;
    email: string;
    role: 'admin' | 'user';
    notificationsEnabled: boolean;
    avatar: string;
}

export interface Vehicle {
    id: number;
    user_id: number;
    license_plate: string;
    brand: string;
    model: string;
    year: number;
    color: string;
    vin: string;
    hsn: string;
    tsn: string;
    mileage: number;
    purchase_date: string;
    purchase_price: number;
    total_expenses: number;
    next_tuev_date: string;
    image_path: string;
    udp_token: string;
    engine_runtime: number;
    engine_status: 'off' | 'ignition' | 'running';
    fuel_level: number;
    last_seen: string;
    created_at: string;
}

export type MaintenanceType =
    | 'oil_change'
    | 'inspection'
    | 'custom_inspection'
    | 'tuev'
    | 'repair'
    | 'invoice'
    | 'fuel_stop';

export const MaintenanceTypeLabels: Record<MaintenanceType, string> = {
    oil_change: 'Ölwechsel',
    inspection: 'Inspektion',
    custom_inspection: 'Eigene Durchsicht',
    tuev: 'TÜV / HU / AU',
    repair: 'Reparatur',
    invoice: 'Rechnung',
    fuel_stop: 'Tanken',
};

export const MaintenanceTypeColors: Record<MaintenanceType, string> = {
    oil_change: '#F59E0B',
    inspection: '#3B82F6',
    custom_inspection: '#8B5CF6',
    tuev: '#10B981',
    repair: '#EF4444',
    invoice: '#6B7280',
    fuel_stop: '#06B6D4',
};

export interface MaintenanceRecord {
    id: number;
    vehicle_id: number;
    type: MaintenanceType;
    title: string;
    description: string;
    date: string;
    mileage: number;
    cost: number;
    fuel_amount?: number;
    fuel_price_per_liter?: number;
    fuel_type?: string;
    interval_days?: number;
    interval_km?: number;
    interval_engine_hours?: number;
    created_at: string;
}

export interface NotificationInterval {
    id: number;
    vehicle_id: number;
    maintenance_type: MaintenanceType;
    interval_days: number | null;
    interval_km: number | null;
    interval_engine_hours: number | null;
    last_notified: string | null;
}

export interface LiveData {
    vehicleId: number;
    mileage?: number;
    fuelLevel?: number;
    engineStatus?: 'off' | 'ignition' | 'running';
    engineRuntime?: number;
    lastSeen: string;
}
