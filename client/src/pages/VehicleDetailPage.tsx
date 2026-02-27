import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Vehicle, MaintenanceRecord, MaintenanceType } from '../types';
import { MaintenanceTypeLabels, MaintenanceTypeColors } from '../types';
import config from '../config';
import {
    ArrowLeft, Save, Trash2, Plus, ChevronDown, ChevronRight,
    Wrench, Droplets, ShieldCheck, FileText, Fuel, Settings2,
    Activity, Gauge, Clock, Wifi, Camera, X as XIcon, Edit3,
    Eye, EyeOff, Copy, Check
} from 'lucide-react';
import { formatRuntime } from '../utils/formatRuntime';
import carPlaceholder from '../assets/car-placeholder.svg';
import ConfirmationModal from '../components/ConfirmationModal';
import Odometer from '../components/ui/Odometer';
import './VehicleDetailPage.css';

import { useEnterNavigation } from '../hooks/useEnterNavigation';

export default function VehicleDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const vehicleId = Number(id);

    // Enter key navigation
    const containerRef = useRef<HTMLDivElement>(null);
    useEnterNavigation(containerRef);

    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [activeTab, setActiveTab] = useState('stammdaten');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState<Record<string, any>>({});

    // Maintenance form
    const [showMaintForm, setShowMaintForm] = useState(false);
    const [maintForm, setMaintForm] = useState<any>({
        type: 'oil_change', title: '', description: '', date: '', mileage: 0, cost: 0,
        fuelAmount: 0, fuelPricePerLiter: 0, fuelType: 'Super E5',
        intervalDays: '', intervalKm: '', intervalEngineHours: ''
    });

    // History collapsed state
    const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());

    // Calendar state
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());

    // Live data (via WebSocket)
    const [liveData, setLiveData] = useState<any>(null);

    // Image upload
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Edit/Delete state
    const [showDeleteVehicleModal, setShowDeleteVehicleModal] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
    const [showToken, setShowToken] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [v, r] = await Promise.all([
                api.vehicles.get(vehicleId),
                api.maintenance.list(vehicleId),
            ]);
            setVehicle(v);
            setRecords(r);
            setEditData({
                licensePlate: v.license_plate,
                brand: v.brand,
                model: v.model,
                year: v.year,
                color: v.color,
                vin: v.vin,
                hsn: v.hsn,
                tsn: v.tsn,
                mileage: v.mileage,
                purchaseDate: v.purchase_date,
                purchasePrice: v.purchase_price,
                nextTuevDate: v.next_tuev_date,
                udpToken: v.udp_token,
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [vehicleId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // WebSocket for live data
    useEffect(() => {
        if (!vehicle) return;
        let ws: WebSocket | null = null;
        try {
            ws = new WebSocket(config.wsUrl);
            ws.onopen = () => ws?.send(JSON.stringify({ subscribe: [vehicleId] }));
            ws.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.type === 'live-update' && data.vehicleId === vehicleId) {
                    setLiveData(data);
                }
            };
        } catch { /* ignore ws errors */ }
        return () => { ws?.close(); };
    }, [vehicle, vehicleId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.vehicles.update(vehicleId, editData);
            fetchData();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddMaintenance = async () => {
        try {
            const data = {
                ...maintForm,
                intervalDays: maintForm.intervalDays ? Number(maintForm.intervalDays) : undefined,
                intervalKm: maintForm.intervalKm ? Number(maintForm.intervalKm) : undefined,
                intervalEngineHours: maintForm.intervalEngineHours ? Number(maintForm.intervalEngineHours) : undefined,
            };

            if (editingRecordId) {
                await api.maintenance.update(vehicleId, editingRecordId, data);
            } else {
                await api.maintenance.create(vehicleId, data);
            }
            setShowMaintForm(false);
            setEditingRecordId(null);
            setMaintForm({ type: 'oil_change', title: '', description: '', date: '', mileage: 0, cost: 0, fuelAmount: 0, fuelPricePerLiter: 0, fuelType: 'Super E5', intervalDays: '', intervalKm: '', intervalEngineHours: '' });
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleEditRecord = (r: MaintenanceRecord) => {
        setMaintForm({
            type: r.type,
            title: r.title || '',
            description: r.description || '',
            date: r.date ? r.date.slice(0, 10) : '',
            mileage: r.mileage,
            cost: r.cost,
            fuelAmount: r.fuel_amount || 0,
            fuelPricePerLiter: r.fuel_price_per_liter || 0,
            fuelType: r.fuel_type || 'Super E5',
            intervalDays: r.interval_days || '',
            intervalKm: r.interval_km || '',
            intervalEngineHours: r.interval_engine_hours || ''
        });
        setEditingRecordId(r.id);
        setShowMaintForm(true);
    };

    const handleDeleteRecord = async (recordId: number) => {
        if (!confirm('Eintrag wirklich löschen?')) return;
        try {
            await api.maintenance.delete(vehicleId, recordId);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleDeleteVehicle = () => {
        setShowDeleteVehicleModal(true);
    };

    const confirmDeleteVehicle = async () => {
        try {
            await api.vehicles.delete(vehicleId);
            navigate('/');
        } catch (err) { console.error(err); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            await api.vehicles.uploadImage(vehicleId, file);
            fetchData();
        } catch (err) { console.error(err); }
        finally { setUploadingImage(false); }
    };

    const handleDeleteImage = async () => {
        if (!confirm('Fahrzeugbild wirklich löschen?')) return;
        try {
            await api.vehicles.deleteImage(vehicleId);
            fetchData();
        } catch (err) { console.error(err); }
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

    // Calendar helpers
    const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (m: number, y: number) => (new Date(y, m, 1).getDay() + 6) % 7; // Monday=0

    const calDays = getDaysInMonth(calMonth, calYear);
    const calStart = getFirstDayOfMonth(calMonth, calYear);

    // Records mapped to calendar dates
    const recordsByDate: Record<string, MaintenanceRecord[]> = {};
    records.forEach(r => {
        const d = r.date?.slice(0, 10);
        if (d) { if (!recordsByDate[d]) recordsByDate[d] = []; recordsByDate[d].push(r); }
    });

    const formattedRuntime = vehicle ? formatRuntime(vehicle.engine_runtime, true) : '0h';

    if (loading) return <div className="empty-state"><p>Lade...</p></div>;
    if (!vehicle) return <div className="empty-state"><p>Fahrzeug nicht gefunden</p></div>;

    const tabs = [
        { id: 'stammdaten', label: 'Stammdaten' },
        { id: 'wartung', label: 'Wartung' },
        { id: 'historie', label: 'Historie' },
        { id: 'kalender', label: 'Kalender' },
        ...(vehicle.last_seen ? [{ id: 'live', label: 'Live' }] : []),
    ];

    const vehicleImageUrl = vehicle.image_path
        ? `${config.apiUrl}${vehicle.image_path}`
        : null;

    return (
        <div>
            {/* ─── Vehicle Image Header ────────────── */}
            <div className="vehicle-detail-hero">
                <div className="vehicle-detail-hero-image">
                    <img src={vehicleImageUrl || carPlaceholder} alt={vehicle.license_plate} />
                    <div className="vehicle-detail-hero-overlay">
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                        />
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={uploadingImage}
                            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                        >
                            <Camera size={14} /> {uploadingImage ? 'Laden...' : 'Bild ändern'}
                        </button>
                        {vehicleImageUrl && (
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={handleDeleteImage}
                                style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                            >
                                <XIcon size={14} /> Entfernen
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => navigate('/')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="page-title">{vehicle.license_plate}</h1>
                        <p className="page-subtitle">{vehicle.brand} {vehicle.model} {vehicle.year > 0 ? `(${vehicle.year})` : ''}</p>
                    </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteVehicle}>
                    <Trash2 size={14} /> Löschen
                </button>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 'var(--space-xl)' }}>
                {tabs.map(t => (
                    <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ─── Stammdaten Tab ──────────────────── */}
            {activeTab === 'stammdaten' && (
                <div className="detail-section" ref={containerRef}>
                    <div className="grid grid-2">
                        {[
                            { label: 'Kennzeichen', key: 'licensePlate', placeholder: 'M-XY 1234' },
                            { label: 'Marke', key: 'brand', placeholder: 'z.B. BMW' },
                            { label: 'Modell', key: 'model', placeholder: 'z.B. 320i' },
                            { label: 'Baujahr', key: 'year', type: 'number', placeholder: '2023' },
                            { label: 'Farbe', key: 'color', placeholder: 'Schwarz' },
                            { label: 'VIN', key: 'vin', placeholder: 'WBA...' },
                            { label: 'HSN', key: 'hsn', placeholder: '0005' },
                            { label: 'TSN', key: 'tsn', placeholder: 'ABC' },
                            { label: 'Kilometerstand', key: 'mileage', type: 'number' },
                            { label: 'Kaufdatum', key: 'purchaseDate', type: 'date' },
                            { label: 'Kaufpreis (€)', key: 'purchasePrice', type: 'number' },
                            { label: 'Nächster TÜV', key: 'nextTuevDate', type: 'date' },
                        ].map(field => (
                            <div className="form-group" key={field.key}>
                                <label className="form-label">{field.label}</label>
                                <input
                                    className="form-input"
                                    type={field.type || 'text'}
                                    value={(editData as any)[field.key] ?? ''}
                                    placeholder={(field as any).placeholder}
                                    onChange={e => {
                                        let val = e.target.value;
                                        if (['licensePlate', 'vin', 'hsn', 'tsn'].includes(field.key)) {
                                            val = val.toUpperCase();
                                        }
                                        setEditData(d => ({ ...d, [field.key]: field.type === 'number' ? Number(val) : val }));
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="card" style={{ marginTop: 'var(--space-lg)', background: 'var(--bg-base)' }}>
                        <div className="form-group">
                            <label className="form-label">UDP Token (für Live-Datenübertragung)</label>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        className="form-input"
                                        value={editData.udpToken ?? ''}
                                        readOnly
                                        style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.8125rem',
                                            filter: showToken ? 'none' : 'blur(6px)',
                                            userSelect: showToken ? 'all' : 'none',
                                            transition: 'filter 0.2s ease',
                                        }}
                                    />
                                </div>
                                <button
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => setShowToken(!showToken)}
                                    title={showToken ? 'Token verbergen' : 'Token anzeigen'}
                                    style={{ flexShrink: 0 }}
                                >
                                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <button
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => {
                                        navigator.clipboard.writeText(editData.udpToken ?? '');
                                        setTokenCopied(true);
                                        setTimeout(() => setTokenCopied(false), 2000);
                                    }}
                                    title="In Zwischenablage kopieren"
                                    style={{ flexShrink: 0, color: tokenCopied ? 'var(--success)' : undefined }}
                                >
                                    {tokenCopied ? <Check size={18} /> : <Copy size={18} />}
                                </button>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Dieses Token wird verwendet, um Daten vom Fahrzeug über UDP zuzuordnen.
                            </p>
                        </div>
                    </div>

                    <div className="detail-summary">
                        <div className="card">
                            <span className="form-label">Kilometerstand</span>
                            <div style={{ marginTop: 'var(--space-sm)' }}>
                                <Odometer value={vehicle.mileage} decimal={!!vehicle.last_seen} animate={false} />
                            </div>
                        </div>
                        <div className="card">
                            <span className="form-label">Gesamtausgaben</span>
                            <span className="stat-value">{vehicle.total_expenses.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                        </div>
                        <div className="card">
                            <span className="form-label">Motorlaufzeit</span>
                            <span className="stat-value">{formattedRuntime}</span>
                        </div>
                    </div>

                    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 'var(--space-lg)' }}>
                        <Save size={16} /> {saving ? 'Speichern...' : 'Speichern'}
                    </button>
                </div>
            )}

            {/* ─── Wartung Tab ─────────────────────── */}
            {activeTab === 'wartung' && (
                <div className="detail-section">
                    <button className="btn btn-primary" onClick={() => setShowMaintForm(true)} style={{ marginBottom: 'var(--space-lg)' }}>
                        <Plus size={16} /> Neuer Eintrag
                    </button>

                    {showMaintForm && (
                        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>
                                {editingRecordId ? 'Eintrag bearbeiten' : 'Neuer Wartungseintrag'}
                            </h3>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">Typ</label>
                                    <select className="form-select" value={maintForm.type} onChange={e => setMaintForm((f: any) => ({ ...f, type: e.target.value }))}>
                                        {Object.entries(MaintenanceTypeLabels).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Titel</label>
                                    <input className="form-input" value={maintForm.title} onChange={e => setMaintForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="z.B. Ölwechsel 5W-30" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Datum</label>
                                    <input className="form-input" type="date" value={maintForm.date} onChange={e => setMaintForm((f: any) => ({ ...f, date: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">KM-Stand</label>
                                    <input className="form-input" type="number" value={maintForm.mileage} onChange={e => setMaintForm((f: any) => ({ ...f, mileage: Number(e.target.value) }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Kosten (€)</label>
                                    <input className="form-input" type="number" step="0.01" value={maintForm.cost} onChange={e => setMaintForm((f: any) => ({ ...f, cost: Number(e.target.value) }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Beschreibung</label>
                                    <textarea className="form-textarea" value={maintForm.description} onChange={e => setMaintForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                                </div>

                                {maintForm.type === 'fuel_stop' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Liter</label>
                                            <input className="form-input" type="number" step="0.01" value={maintForm.fuelAmount} onChange={e => setMaintForm((f: any) => ({ ...f, fuelAmount: Number(e.target.value) }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Preis/Liter (€)</label>
                                            <input className="form-input" type="number" step="0.001" value={maintForm.fuelPricePerLiter} onChange={e => setMaintForm((f: any) => ({ ...f, fuelPricePerLiter: Number(e.target.value) }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Kraftstoff</label>
                                            <select className="form-select" value={maintForm.fuelType} onChange={e => setMaintForm((f: any) => ({ ...f, fuelType: e.target.value }))}>
                                                <option>Super E5</option>
                                                <option>Super E10</option>
                                                <option>Diesel</option>
                                                <option>Super Plus</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="card" style={{ marginTop: 'var(--space-md)', background: 'var(--bg-base)' }}>
                                <p className="form-label" style={{ marginBottom: 'var(--space-sm)' }}>Erinnerungsintervall (optional)</p>
                                <div className="grid grid-3">
                                    <div className="form-group">
                                        <label className="form-label">Tage</label>
                                        <input className="form-input" type="number" value={maintForm.intervalDays} onChange={e => setMaintForm((f: any) => ({ ...f, intervalDays: e.target.value }))} placeholder="z.B. 365" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Kilometer</label>
                                        <input className="form-input" type="number" value={maintForm.intervalKm} onChange={e => setMaintForm((f: any) => ({ ...f, intervalKm: e.target.value }))} placeholder="z.B. 15000" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Motorstunden</label>
                                        <input className="form-input" type="number" value={maintForm.intervalEngineHours} onChange={e => setMaintForm((f: any) => ({ ...f, intervalEngineHours: e.target.value }))} placeholder="z.B. 500" />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => { setShowMaintForm(false); setEditingRecordId(null); }}>Abbrechen</button>
                                <button className="btn btn-primary" onClick={handleAddMaintenance}>Speichern</button>
                            </div>
                        </div>
                    )}

                    {records.length === 0 ? (
                        <div className="empty-state"><Wrench size={32} /><p>Noch keine Wartungseinträge</p></div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {records.filter(r => r.type !== 'fuel_stop').slice(0, 10).map(r => (
                                <div className="card" key={r.id} style={{ padding: 'var(--space-md) var(--space-lg)', borderLeft: `3px solid ${MaintenanceTypeColors[r.type] || 'var(--border)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            <span style={{ color: MaintenanceTypeColors[r.type] }}>{getMaintenanceIcon(r.type)}</span>
                                            <div>
                                                <strong>{r.title || MaintenanceTypeLabels[r.type]}</strong>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {r.date && new Date(r.date).toLocaleDateString('de-DE')} · {r.mileage.toLocaleString('de-DE')} km
                                                    {r.cost > 0 && ` · ${r.cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditRecord(r)}>
                                                <Edit3 size={14} />
                                            </button>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDeleteRecord(r.id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── Historie Tab ────────────────────── */}
            {activeTab === 'historie' && (
                <div className="detail-section">
                    {records.length === 0 ? (
                        <div className="empty-state"><Clock size={32} /><p>Noch keine Einträge vorhanden</p></div>
                    ) : (
                        <div className="history-list">
                            {records.map(r => (
                                <div className="history-item" key={r.id} style={{ borderLeft: `3px solid ${MaintenanceTypeColors[r.type] || 'var(--border)'}` }}>
                                    <div className="history-header" onClick={() => toggleRecord(r.id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            {expandedRecords.has(r.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            <span style={{ color: MaintenanceTypeColors[r.type] }}>{getMaintenanceIcon(r.type)}</span>
                                            <span className="history-title">{r.title || MaintenanceTypeLabels[r.type]}</span>
                                            <span className="badge" style={{ background: MaintenanceTypeColors[r.type] + '22', color: MaintenanceTypeColors[r.type], fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}>
                                                {MaintenanceTypeLabels[r.type]}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            <span className="history-date">{r.date && new Date(r.date).toLocaleDateString('de-DE')}</span>
                                            <div onClick={(e) => { e.stopPropagation(); }}>
                                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setActiveTab('wartung'); handleEditRecord(r); }}>
                                                    <Edit3 size={14} />
                                                </button>
                                            </div>
                                        </div>
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
            )}

            {/* ─── Kalender Tab ────────────────────── */}
            {activeTab === 'kalender' && (
                <div className="detail-section">
                    <div className="calendar-nav">
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                            if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                            else setCalMonth(calMonth - 1);
                        }}>←</button>
                        <span className="calendar-title">
                            {new Date(calYear, calMonth).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                            if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                            else setCalMonth(calMonth + 1);
                        }}>→</button>
                    </div>

                    <div className="calendar-grid">
                        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                            <div className="calendar-dayname" key={d}>{d}</div>
                        ))}
                        {Array.from({ length: calStart }, (_, i) => (
                            <div className="calendar-cell empty" key={`e-${i}`} />
                        ))}
                        {Array.from({ length: calDays }, (_, i) => {
                            const day = i + 1;
                            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const hasRecords = recordsByDate[dateStr];
                            const isToday = dateStr === new Date().toISOString().slice(0, 10);
                            return (
                                <div className={`calendar-cell ${isToday ? 'today' : ''} ${hasRecords ? 'has-event' : ''}`} key={day}>
                                    <span className="calendar-day">{day}</span>
                                    {hasRecords && (
                                        <div className="calendar-events">
                                            {hasRecords.slice(0, 3).map(r => (
                                                <div
                                                    className="calendar-event-dot"
                                                    key={r.id}
                                                    title={r.title || MaintenanceTypeLabels[r.type]}
                                                    style={{ background: MaintenanceTypeColors[r.type] || 'var(--accent)' }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── Live Tab ────────────────────────── */}
            {activeTab === 'live' && (
                <div className="detail-section">
                    <div className="grid grid-2">
                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                <Wifi size={18} />
                                <span className="form-label">Motorstatus</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <span className={`status-dot ${liveData?.engineStatus || vehicle.engine_status}`} />
                                <span className="stat-value" style={{ fontSize: '1.25rem' }}>
                                    {({ off: 'Aus', ignition: 'Zündung an', running: 'Motor läuft' } as Record<string, string>)[liveData?.engineStatus || vehicle.engine_status]}
                                </span>
                            </div>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                <Gauge size={18} />
                                <span className="form-label">Kilometerstand</span>
                            </div>
                            <Odometer value={liveData?.mileage ?? vehicle.mileage} decimal animate />
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                <Activity size={18} />
                                <span className="form-label">Motorlaufzeit</span>
                            </div>
                            <span className="stat-value">{formattedRuntime}</span>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                <Fuel size={18} />
                                <span className="form-label">Tankstand</span>
                            </div>
                            <div className="fuel-bar-wrap">
                                <div className="fuel-bar" style={{ width: `${liveData?.fuelLevel ?? vehicle.fuel_level}%` }} />
                            </div>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)', display: 'block' }}>
                                {Math.round(liveData?.fuelLevel ?? vehicle.fuel_level)}%
                            </span>
                        </div>
                    </div>

                    {vehicle.last_seen && (
                        <p style={{ marginTop: 'var(--space-lg)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Zuletzt gesehen: {new Date(vehicle.last_seen).toLocaleString('de-DE')}
                        </p>
                    )}
                </div>
            )}

            <ConfirmationModal
                isOpen={showDeleteVehicleModal}
                onClose={() => setShowDeleteVehicleModal(false)}
                onConfirm={confirmDeleteVehicle}
                title="Fahrzeug löschen"
                message={`Möchten Sie das Fahrzeug "${vehicle.brand} ${vehicle.model}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Daten (Wartungseinträge, Bilder) werden ebenfalls gelöscht.`}
                confirmPhrase={vehicle.license_plate}
            />
        </div>
    );
}
