import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Wrench, Eye, EyeOff, Fingerprint, ShieldCheck, UserPlus, Mail } from 'lucide-react';
import './LoginPage.css';

type Mode = 'login' | 'register' | 'forgot';

export default function LoginPage() {
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const [mode, setMode] = useState<Mode>('login');
    const [registrationEnabled, setRegistrationEnabled] = useState(false);

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.auth.registrationStatus()
            .then(data => setRegistrationEnabled(data.registrationEnabled))
            .catch(() => setRegistrationEnabled(false));
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (mode === 'register') {
            if (password !== confirmPassword) {
                setError('Passwörter stimmen nicht überein');
                return;
            }
            if (password.length < 6) {
                setError('Passwort muss mindestens 6 Zeichen lang sein');
                return;
            }
        }

        setLoading(true);
        try {
            if (mode === 'login') {
                await login(username, password);
                navigate('/');
            } else if (mode === 'register') {
                await register(username, email, password);
                navigate('/');
            } else if (mode === 'forgot') {
                if (!email) { setError('Bitte E-Mail-Adresse eingeben'); setLoading(false); return; }
                const result = await api.auth.forgotPassword(email);
                setSuccessMsg(result.message);
            }
        } catch (err: any) {
            setError(err.message || 'Vorgang fehlgeschlagen');
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode: Mode) => {
        setMode(newMode);
        setError('');
        setSuccessMsg('');
        setPassword('');
        setConfirmPassword('');
    };

    const subtitle = {
        login: 'Melden Sie sich an, um fortzufahren',
        register: 'Erstellen Sie ein neues Konto',
        forgot: 'Wir senden Ihnen einen Link zum Zurücksetzen',
    }[mode];

    return (
        <div className="login-page">
            <div className="login-bg" />
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">
                        <Wrench size={32} />
                    </div>
                    <h1 className="login-title">Serviceheft</h1>
                    <p className="login-subtitle">{subtitle}</p>
                </div>

                {error && <div className="login-error">{error}</div>}
                {successMsg && (
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.625rem var(--space-md)',
                        color: 'var(--success)',
                        fontSize: '0.8125rem',
                        marginBottom: 'var(--space-md)',
                    }}>
                        {successMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                    {/* Username – only for login and register */}
                    {mode !== 'forgot' && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="username">Benutzername</label>
                            <input
                                id="username"
                                className="form-input"
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="admin"
                                autoComplete="username"
                                required
                            />
                        </div>
                    )}

                    {/* Email – for register and forgot */}
                    {(mode === 'register' || mode === 'forgot') && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">E-Mail</label>
                            <input
                                id="email"
                                className="form-input"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="name@beispiel.de"
                                autoComplete="email"
                                required
                            />
                        </div>
                    )}

                    {/* Password – for login and register */}
                    {mode !== 'forgot' && (
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="form-label" htmlFor="password">Passwort</label>
                                {mode === 'login' && (
                                    <button
                                        type="button"
                                        className="login-forgot-link"
                                        onClick={() => switchMode('forgot')}
                                    >
                                        Passwort vergessen?
                                    </button>
                                )}
                            </div>
                            <div className="password-wrap">
                                <input
                                    id="password"
                                    className="form-input"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Confirm password – for register only */}
                    {mode === 'register' && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="confirmPassword">Passwort bestätigen</label>
                            <div className="password-wrap">
                                <input
                                    id="confirmPassword"
                                    className="form-input"
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                        {loading ? 'Bitte warten...' : ({
                            login: 'Anmelden',
                            register: 'Registrieren',
                            forgot: 'Link senden',
                        }[mode])}
                    </button>
                </form>

                {/* Mode switch buttons */}
                {mode === 'forgot' && (
                    <button
                        className="btn btn-ghost login-switch-btn"
                        type="button"
                        onClick={() => switchMode('login')}
                    >
                        <Mail size={16} />
                        <span>Zurück zur Anmeldung</span>
                    </button>
                )}

                {mode !== 'forgot' && registrationEnabled && (
                    <button
                        className="btn btn-ghost login-switch-btn"
                        type="button"
                        onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    >
                        <UserPlus size={16} />
                        <span>
                            {mode === 'login'
                                ? 'Neues Konto erstellen'
                                : 'Bereits ein Konto? Anmelden'}
                        </span>
                    </button>
                )}

                {mode !== 'forgot' && (
                    <>
                        <div className="login-divider">
                            <span>oder</span>
                        </div>

                        <div className="login-alt-methods">
                            <button className="btn btn-secondary login-alt-btn" type="button">
                                <Fingerprint size={18} />
                                <span>Passkey verwenden</span>
                            </button>
                            <button className="btn btn-secondary login-alt-btn" type="button">
                                <ShieldCheck size={18} />
                                <span>Authelia Login</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
