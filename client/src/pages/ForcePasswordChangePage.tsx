import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function ForcePasswordChangePage() {
    const { refreshUser } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('Passwort muss mindestens 6 Zeichen lang sein');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwörter stimmen nicht überein');
            return;
        }

        setLoading(true);
        try {
            await api.settings.updateProfile({ newPassword, currentPassword: '' });
            await refreshUser();
        } catch (err: any) {
            // If "current password required", the first change doesn't need one (must_change_password flow)
            // Try without currentPassword — the server should allow it for must_change_password
            setError(err.message || 'Fehler beim Ändern des Passworts');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'var(--warning-bg)', color: 'var(--warning)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto var(--space-md)',
                    }}>
                        <AlertTriangle size={28} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                        Passwort ändern
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Sie müssen Ihr Passwort ändern, bevor Sie fortfahren können.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="error-message" style={{ marginBottom: 'var(--space-md)' }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Neues Passwort</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{
                                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                            }} />
                            <input
                                className="form-input"
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Mindestens 6 Zeichen"
                                style={{ paddingLeft: 40, paddingRight: 40 }}
                                required
                                minLength={6}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                                    padding: 4,
                                }}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Passwort bestätigen</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{
                                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                            }} />
                            <input
                                className="form-input"
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Passwort wiederholen"
                                style={{ paddingLeft: 40 }}
                                required
                            />
                        </div>
                    </div>

                    <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={loading || !newPassword || !confirmPassword}
                        style={{ width: '100%', marginTop: 'var(--space-md)' }}
                    >
                        {loading ? 'Wird gespeichert...' : 'Passwort ändern'}
                    </button>
                </form>
            </div>
        </div>
    );
}
