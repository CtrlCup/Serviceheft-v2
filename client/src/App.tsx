import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage';
import DashboardPage from './pages/DashboardPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';

function AppRoutes() {
  const { isAuthenticated, loading, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Lade...
      </div>
    );
  }

  // Force password change: redirect all routes to /change-password
  if (isAuthenticated && mustChangePassword) {
    return (
      <Routes>
        <Route path="/change-password" element={<ForcePasswordChangePage />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/reset-password" element={isAuthenticated ? <Navigate to="/" replace /> : <ResetPasswordPage />} />
      <Route path="/change-password" element={<Navigate to="/" replace />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/vehicle/:id" element={<VehicleDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
