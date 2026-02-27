import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

/**
 * Force Password Change Modal – Renders as a centered modal overlay
 * with blurred background showing the dashboard beneath.
 */
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
            setError(err.message || 'Fehler beim Ändern des Passworts');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: 'var(--space-lg)',
            animation: 'fadeIn 0.3s ease-out',
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: 440,
                animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 40px rgba(99, 102, 241, 0.1)',
                padding: 'var(--space-2xl)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'var(--warning-bg)', color: 'var(--warning)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto var(--space-md)',
                    }}>
                        <AlertTriangle size={28} />
                    </div>
                    <h1 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                        Passwort ändern
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                        Sie müssen Ihr Passwort ändern, bevor Sie fortfahren können.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{
                            background: 'var(--danger-bg)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.625rem var(--space-md)',
                            color: 'var(--danger)',
                            fontSize: '0.8125rem',
                            marginBottom: 'var(--space-md)',
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
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

                    <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
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
                        style={{ width: '100%' }}
                    >
                        {loading ? 'Wird gespeichert...' : 'Passwort ändern'}
                    </button>
                </form>
            </div>
        </div>
    );
}
