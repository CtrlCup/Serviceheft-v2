import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicShare } from '../services/api';
import type { MaintenanceRecord, MaintenanceType } from '../types';
import { MaintenanceTypeLabels, MaintenanceTypeColors } from '../types';
import config from '../config';
import {
    Lock, Wrench, Droplets, ShieldCheck, FileText, Fuel, Settings2,
    ChevronDown, ChevronRight, Clock, AlertTriangle
} from 'lucide-react';
import carPlaceholder from '../assets/car-placeholder.svg';
import './VehicleDetailPage.css';

/**
 * Public vehicle view page – accessible via share link without login.
 * Read-only display of vehicle data and maintenance history.
 */
export default function SharedVehiclePage() {
    const { token } = useParams<{ token: string }>();
    const [vehicle, setVehicle] = useState<any>(null);
    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [label, setLabel] = useState('');
    const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());

    const loadData = async (pw?: string) => {
        try {
            setLoading(true);
            setError('');
            const data = await fetchPublicShare(token!, pw);
            if (data.requiresPassword) {
                setRequiresPassword(true);
                setLabel(data.label || '');
                return;
            }
            setVehicle(data.vehicle);
            setRecords(data.records || []);
            setLabel(data.label || '');
            setRequiresPassword(false);
        } catch (err: any) {
            setError(err.message || 'Zugriff fehlgeschlagen');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [token]);

    const handlePasswordSubmit = () => {
        loadData(password);
    };

    const toggleRecord = (id: number) => {
        const s = new Set(expandedRecords);
        s.has(id) ? s.delete(id) : s.add(id);
        setExpandedRecords(s);
    };

    const getMaintenanceIcon = (type: MaintenanceType) => {
        switch (type) {
            case 'oil_change': return <Droplets size={16} />;
            case 'inspection': case 'custom_inspection': return <Settings2 size={16} />;
            case 'tuev': return <ShieldCheck size={16} />;
            case 'repair': return <Wrench size={16} />;
            case 'invoice': return <FileText size={16} />;
            case 'fuel_stop': return <Fuel size={16} />;
            default: return <Wrench size={16} />;
        }
    };

    // Password entry screen
    if (requiresPassword && !vehicle) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-base)',
                padding: 'var(--space-lg)'
            }}>
                <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
                    <Lock size={48} style={{ color: 'var(--accent)', marginBottom: 'var(--space-md)' }} />
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Passwortgeschützt</h2>
                    {label && <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>{label}</p>}
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        Dieser Link ist passwortgeschützt. Bitte geben Sie das Passwort ein.
                    </p>
                    {error && <p style={{ color: 'var(--danger)', marginBottom: 'var(--space-sm)' }}>{error}</p>}
                    <input
                        className="form-input"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                        placeholder="Passwort"
                        autoFocus
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handlePasswordSubmit}
                        style={{ marginTop: 'var(--space-md)', width: '100%' }}
                    >
                        Zugriff
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-base)'
            }}>
                <p style={{ color: 'var(--text-muted)' }}>Laden...</p>
            </div>
        );
    }

    // Error state
    if (error || !vehicle) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-base)',
                padding: 'var(--space-lg)'
            }}>
                <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
                    <AlertTriangle size={48} style={{ color: 'var(--warning)', marginBottom: 'var(--space-md)' }} />
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Nicht verfügbar</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {error || 'Dieser Link ist ungültig oder abgelaufen.'}
                    </p>
                </div>
            </div>
        );
    }

    const vehicleImageUrl = vehicle.image_path
        ? `${config.apiUrl}${vehicle.image_path}`
        : null;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
            {/* Shared badge */}
            <div style={{
                background: 'var(--accent)',
                color: '#fff',
                textAlign: 'center',
                padding: 'var(--space-xs) var(--space-md)',
                fontSize: '0.8125rem',
                fontWeight: 500
            }}>
                📋 Geteiltes Fahrzeug – Nur-Lese-Ansicht
                {label && ` · ${label}`}
            </div>

            {/* Vehicle header */}
            <div className="vehicle-detail-hero">
                <div className="vehicle-detail-hero-image">
                    <img src={vehicleImageUrl || carPlaceholder} alt={vehicle.license_plate} />
                </div>
            </div>

            <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-lg)' }}>
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <h1 className="page-title">{vehicle.license_plate}</h1>
                    <p className="page-subtitle">
                        {vehicle.brand} {vehicle.model} {vehicle.year > 0 ? `(${vehicle.year})` : ''}
                    </p>
                </div>

                {/* Vehicle info grid */}
                <div className="grid grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
                    {[
                        { label: 'Marke', value: vehicle.brand },
                        { label: 'Modell', value: vehicle.model },
                        { label: 'Baujahr', value: vehicle.year > 0 ? vehicle.year : '-' },
                        { label: 'Farbe', value: vehicle.color || '-' },
                        { label: 'Kilometerstand', value: `${Math.round(vehicle.mileage).toLocaleString('de-DE')} km` },
                        { label: 'Nächster TÜV', value: vehicle.next_tuev_date ? new Date(vehicle.next_tuev_date).toLocaleDateString('de-DE') : '-' },
                    ].map((item, i) => (
                        <div className="card" key={i} style={{ padding: 'var(--space-md)' }}>
                            <span className="form-label">{item.label}</span>
                            <span className="stat-value" style={{ fontSize: '1rem', display: 'block', marginTop: 'var(--space-xs)' }}>
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Maintenance history */}
                <h2 style={{ marginBottom: 'var(--space-md)', fontSize: '1.25rem' }}>
                    <Clock size={20} style={{ verticalAlign: 'text-bottom', marginRight: 'var(--space-xs)' }} />
                    Wartungshistorie
                </h2>
                {records.length === 0 ? (
                    <div className="empty-state">
                        <Wrench size={32} />
                        <p>Noch keine Wartungseinträge</p>
                    </div>
                ) : (
                    <div className="history-list">
                        {records.map(r => (
                            <div className="history-item" key={r.id} style={{
                                borderLeft: `3px solid ${MaintenanceTypeColors[r.type] || 'var(--border)'}`
                            }}>
                                <div className="history-header" onClick={() => toggleRecord(r.id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                        {expandedRecords.has(r.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        <span style={{ color: MaintenanceTypeColors[r.type] }}>{getMaintenanceIcon(r.type)}</span>
                                        <span className="history-title">{r.title || MaintenanceTypeLabels[r.type]}</span>
                                        <span className="badge" style={{
                                            background: MaintenanceTypeColors[r.type] + '22',
                                            color: MaintenanceTypeColors[r.type],
                                            fontSize: '0.625rem',
                                            padding: '0.125rem 0.375rem'
                                        }}>
                                            {MaintenanceTypeLabels[r.type]}
                                        </span>
                                    </div>
                                    <span className="history-date">
                                        {r.date && new Date(r.date).toLocaleDateString('de-DE')}
                                    </span>
                                </div>
                                {expandedRecords.has(r.id) && (
                                    <div className="history-details">
                                        <div className="history-detail-grid">
                                            <span>Typ:</span><span>{MaintenanceTypeLabels[r.type]}</span>
                                            <span>KM-Stand:</span><span>{r.mileage.toLocaleString('de-DE')} km</span>
                                            {r.cost > 0 && <><span>Kosten:</span><span>{r.cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span></>}
                                            {r.description && <><span>Beschreibung:</span><span>{r.description}</span></>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
