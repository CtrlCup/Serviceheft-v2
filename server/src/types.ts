// ──────────────────────────────────────
// Shared TypeScript types for the app
// ──────────────────────────────────────

export interface User {
    id: number;
    username: string;
    email: string;
    passwordHash: string;
    role: 'admin' | 'user';
    notificationsEnabled: boolean;
    createdAt: string;
}

export interface Vehicle {
    id: number;
    userId: number;
    licensePlate: string;
    brand: string;
    model: string;
    year: number;
    color: string;
    vin: string;
    hsn: string;
    tsn: string;
    mileage: number;
    purchaseDate: string;
    purchasePrice: number;
    totalExpenses: number;
    nextTuevDate: string;
    imagePath: string;
    udpToken: string;        // Unique token for UDP data ingestion
    engineRuntime: number;    // Total engine runtime in seconds
    engineStatus: 'off' | 'ignition' | 'running';
    fuelLevel: number;        // Percentage 0-100
    lastSeen: string;         // Last UDP data received
    createdAt: string;
}

export type MaintenanceType =
    | 'oil_change'
    | 'inspection'
    | 'custom_inspection'
    | 'tuev'
    | 'repair'
    | 'invoice'
    | 'fuel_stop';

export interface MaintenanceRecord {
    id: number;
    vehicleId: number;
    type: MaintenanceType;
    title: string;
    description: string;
    date: string;
    mileage: number;
    cost: number;
    // Fuel stop specific
    fuelAmount?: number;      // Liters
    fuelPricePerLiter?: number;
    fuelType?: string;
    // Interval for next maintenance
    intervalDays?: number;
    intervalKm?: number;
    intervalEngineHours?: number;
    createdAt: string;
}

export interface LiveDataPayload {
    vehicleToken: string;
    km?: number;
    fuelLevel?: number;
    fuelStop?: {
        liters: number;
        pricePerLiter: number;
        fuelType: string;
    };
    engineStatus?: 'off' | 'ignition' | 'running';
    engineRuntime?: number; // seconds
}

export interface NotificationInterval {
    id: number;
    vehicleId: number;
    maintenanceType: MaintenanceType;
    intervalDays: number | null;
    intervalKm: number | null;
    intervalEngineHours: number | null;
    lastNotified: string | null;
}

// API response wrappers
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
