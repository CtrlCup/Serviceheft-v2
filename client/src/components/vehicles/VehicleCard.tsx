import { useNavigate } from 'react-router-dom';
import { Gauge, Calendar, Fuel, Activity } from 'lucide-react';
import type { Vehicle } from '../../types';
import './VehicleCard.css';

interface Props {
    vehicle: Vehicle;
}

export default function VehicleCard({ vehicle }: Props) {
    const navigate = useNavigate();

    const formatKm = (km: number) => km.toLocaleString('de-DE') + ' km';

    const getStatusInfo = () => {
        switch (vehicle.engine_status) {
            case 'running': return { label: 'Läuft', className: 'running' };
            case 'ignition': return { label: 'Zündung an', className: 'ignition' };
            default: return { label: 'Aus', className: 'off' };
        }
    };

    const status = getStatusInfo();
    const engineHours = Math.floor(vehicle.engine_runtime / 3600);
    const engineMinutes = Math.floor((vehicle.engine_runtime % 3600) / 60);

    const tuevDate = vehicle.next_tuev_date ? new Date(vehicle.next_tuev_date) : null;
    const tuevSoon = tuevDate && (tuevDate.getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000;
    const tuevExpired = tuevDate && tuevDate.getTime() < Date.now();

    return (
        <div className="vehicle-card card interactive" onClick={() => navigate(`/vehicle/${vehicle.id}`)}>
            <div className="vehicle-card-image">
                {vehicle.image_path ? (
                    <img src={vehicle.image_path} alt={vehicle.license_plate} />
                ) : (
                    <div className="vehicle-card-placeholder">
                        <Gauge size={32} />
                    </div>
                )}
                {vehicle.last_seen && (
                    <div className={`vehicle-status-badge ${status.className}`}>
                        <span className={`status-dot ${status.className}`} />
                        <span>{status.label}</span>
                    </div>
                )}
            </div>

            <div className="vehicle-card-body">
                <div className="vehicle-card-plate">{vehicle.license_plate || 'Kein Kennzeichen'}</div>
                <div className="vehicle-card-name">{vehicle.brand} {vehicle.model}</div>

                <div className="vehicle-card-stats">
                    <div className="vehicle-stat">
                        <Gauge size={14} />
                        <span>{formatKm(vehicle.mileage)}</span>
                    </div>

                    {tuevDate && (
                        <div className={`vehicle-stat ${tuevExpired ? 'danger' : tuevSoon ? 'warning' : ''}`}>
                            <Calendar size={14} />
                            <span>TÜV {tuevDate.toLocaleDateString('de-DE', { month: '2-digit', year: '2-digit' })}</span>
                        </div>
                    )}

                    {vehicle.fuel_level > 0 && (
                        <div className="vehicle-stat">
                            <Fuel size={14} />
                            <span>{Math.round(vehicle.fuel_level)}%</span>
                        </div>
                    )}

                    {vehicle.engine_runtime > 0 && (
                        <div className="vehicle-stat">
                            <Activity size={14} />
                            <span>{engineHours}h {engineMinutes}m</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
