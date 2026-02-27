import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VehicleCard from '../components/vehicles/VehicleCard';
import type { Vehicle } from '../types';
import { Plus, Car } from 'lucide-react';
import './DashboardPage.css';

export default function DashboardPage() {
    const { user } = useAuth();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newVehicle, setNewVehicle] = useState({ licensePlate: '', brand: '', model: '' });
    const [creating, setCreating] = useState(false);

    const fetchVehicles = async () => {
        try {
            const data = await api.vehicles.list();
            setVehicles(data);
        } catch (err) {
            console.error('Failed to fetch vehicles:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchVehicles(); }, []);

    const handleCreateVehicle = async () => {
        if (!newVehicle.licensePlate) return;
        setCreating(true);
        try {
            await api.vehicles.create(newVehicle);
            setShowModal(false);
            setNewVehicle({ licensePlate: '', brand: '', model: '' });
            fetchVehicles();
        } catch (err) {
            console.error('Failed to create vehicle:', err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Willkommen zurück, {user?.lastname || user?.username}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} />
                    <span>Fahrzeug hinzufügen</span>
                </button>
            </div>

            {loading ? (
                <div className="empty-state"><p>Lade Fahrzeuge...</p></div>
            ) : vehicles.length === 0 ? (
                <div className="empty-state">
                    <Car size={48} />
                    <h3>Noch keine Fahrzeuge</h3>
                    <p>Fügen Sie Ihr erstes Fahrzeug hinzu, um zu beginnen.</p>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={18} /> Fahrzeug hinzufügen
                    </button>
                </div>
            ) : (
                <div className="grid grid-auto">
                    {vehicles.map(v => (
                        <VehicleCard key={v.id} vehicle={v} />
                    ))}
                </div>
            )}

            {/* Add Vehicle Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Neues Fahrzeug</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Kennzeichen *</label>
                                <input
                                    className="form-input"
                                    value={newVehicle.licensePlate}
                                    onChange={e => setNewVehicle(v => ({ ...v, licensePlate: e.target.value }))}
                                    placeholder="z.B. KN-AB 1234"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Marke</label>
                                <input
                                    className="form-input"
                                    value={newVehicle.brand}
                                    onChange={e => setNewVehicle(v => ({ ...v, brand: e.target.value }))}
                                    placeholder="z.B. BMW"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Modell</label>
                                <input
                                    className="form-input"
                                    value={newVehicle.model}
                                    onChange={e => setNewVehicle(v => ({ ...v, model: e.target.value }))}
                                    placeholder="z.B. 320d"
                                />
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Abbrechen</button>
                            <button className="btn btn-primary" onClick={handleCreateVehicle} disabled={creating || !newVehicle.licensePlate}>
                                {creating ? 'Erstelle...' : 'Erstellen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
