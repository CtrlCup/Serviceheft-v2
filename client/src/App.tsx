import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage';
import Layout from './components/layout/Layout';


function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div className="loading">Laden...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/** Inner app component that can safely use useAuth() */
function AppContent() {
  const { isAuthenticated, loading, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Lade...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/reset-password" element={isAuthenticated ? <Navigate to="/" replace /> : <ResetPasswordPage />} />

        <Route path="/*" element={
          <ProtectedRoute>
            <Layout />
            {/* Force password change modal overlay */}
            {mustChangePassword && <ForcePasswordChangePage />}
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

/** Root component – AuthProvider wraps everything so useAuth() works in AppContent */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
