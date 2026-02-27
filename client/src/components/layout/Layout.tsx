import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardPage from '../../pages/DashboardPage';
import VehicleDetailPage from '../../pages/VehicleDetailPage';
import SettingsPage from '../../pages/SettingsPage';
import AdminPage from '../../pages/AdminPage';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (user?.role !== 'admin') return <Navigate to="/" replace />;
    return <>{children}</>;
}

export default function Layout() {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="app-main">
                <div className="app-content">
                    <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/vehicle/:id" element={<VehicleDetailPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/admin" element={
                            <AdminRoute><AdminPage /></AdminRoute>
                        } />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}
