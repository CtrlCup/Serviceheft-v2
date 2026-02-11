import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Wrench, Lock, CheckCircle } from 'lucide-react';
import './LoginPage.css';

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!token) setError('Kein gültiger Reset-Token gefunden');
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Passwort muss mindestens 6 Zeichen lang sein');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwörter stimmen nicht überein');
            return;
        }

        setLoading(true);
        try {
            await api.auth.resetPassword(token, password);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Fehler beim Zurücksetzen');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-bg" />
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">
                        <Wrench size={32} />
                    </div>
                    <h1 className="login-title">Passwort zurücksetzen</h1>
                    <p className="login-subtitle">Geben Sie Ihr neues Passwort ein</p>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center' }}>
                        <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: 'var(--space-md)' }} />
                        <p style={{ fontSize: '0.9375rem', fontWeight: 500, marginBottom: 'var(--space-lg)' }}>
                            Passwort erfolgreich zurückgesetzt!
                        </p>
                        <button className="btn btn-primary login-btn" onClick={() => navigate('/login')}>
                            Zur Anmeldung
                        </button>
                    </div>
                ) : (
                    <>
                        {error && <div className="login-error">{error}</div>}
                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-pw">
                                    <Lock size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                                    Neues Passwort
                                </label>
                                <input
                                    id="new-pw"
                                    className="form-input"
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Mindestens 6 Zeichen"
                                    autoComplete="new-password"
                                    required
                                    disabled={!token}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="confirm-pw">Passwort bestätigen</label>
                                <input
                                    id="confirm-pw"
                                    className="form-input"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    required
                                    disabled={!token}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary login-btn" disabled={loading || !token}>
                                {loading ? 'Bitte warten...' : 'Passwort ändern'}
                            </button>
                        </form>

                        <button
                            className="btn btn-ghost login-switch-btn"
                            type="button"
                            onClick={() => navigate('/login')}
                            style={{ marginTop: 'var(--space-md)' }}
                        >
                            Zurück zur Anmeldung
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
