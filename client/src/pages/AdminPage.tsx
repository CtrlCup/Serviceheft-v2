import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
    Users, Mail, Database, Plus, Trash2, Edit3, Save, X, UserPlus, Settings, AlertTriangle,
    KeyRound, ShieldAlert, ShieldCheck, Send, Copy, Check
} from 'lucide-react';
import './AdminPage.css';

export default function AdminPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState<any[]>([]);
    const [smtp, setSmtp] = useState<any>({});
    const [system, setSystem] = useState<any>(null);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });
    const [editingSmtp, setEditingSmtp] = useState(false);
    const [smtpForm, setSmtpForm] = useState<any>({});

    // Config editing state
    const [configData, setConfigData] = useState<any>(null);
    const [editingConfig, setEditingConfig] = useState(false);
    const [configForm, setConfigForm] = useState<any>({});
    const [configMsg, setConfigMsg] = useState('');

    // Reset system state
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [resetInput, setResetInput] = useState('');
    const [resetting, setResetting] = useState(false);

    // Test email state
    const [testEmailTo, setTestEmailTo] = useState('');
    const [testEmailMsg, setTestEmailMsg] = useState('');
    const [testEmailLoading, setTestEmailLoading] = useState(false);

    // Password reset popup state
    const [resetPasswordPopup, setResetPasswordPopup] = useState<{ username: string; password: string } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        api.admin.getUsers().then(setUsers).catch(console.error);
        api.admin.getSmtp().then(setSmtp).catch(console.error);
        api.admin.getSystem().then(setSystem).catch(console.error);
        api.admin.getConfig().then(setConfigData).catch(console.error);
    }, []);

    const handleToggleRegistration = async () => {
        if (!system) return;
        try {
            const result = await api.admin.toggleRegistration(!system.registrationEnabled);
            setSystem((s: any) => ({ ...s, registrationEnabled: result.registrationEnabled }));
        } catch (err) { console.error(err); }
    };

    const handleCreateUser = async () => {
        try {
            await api.admin.createUser(newUser);
            setShowCreateUser(false);
            setNewUser({ username: '', email: '', password: '', role: 'user' });
            const u = await api.admin.getUsers();
            setUsers(u);
        } catch (err) { console.error(err); }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('Benutzer wirklich löschen?')) return;
        try {
            await api.admin.deleteUser(id);
            setUsers(users.filter(u => u.id !== id));
        } catch (err) { console.error(err); }
    };

    const handleToggleForceChange = async (id: number, currentValue: boolean) => {
        try {
            await api.admin.toggleForcePasswordChange(id, !currentValue);
            setUsers(users.map(u => u.id === id ? { ...u, must_change_password: !currentValue ? 1 : 0 } : u));
        } catch (err) { console.error(err); }
    };

    const handleResetPassword = async (user: any) => {
        if (!confirm(`Passwort für "${user.username}" wirklich zurücksetzen?`)) return;
        try {
            const result = await api.admin.resetUserPassword(user.id);
            // Update the user in the list (must_change_password is now set)
            setUsers(users.map(u => u.id === user.id ? { ...u, must_change_password: 1 } : u));

            if (result.sent) {
                alert(`Neues Passwort wurde per E-Mail an ${user.email} gesendet.`);
            } else if (result.temporaryPassword) {
                setResetPasswordPopup({ username: user.username, password: result.temporaryPassword });
                setCopied(false);
            }
        } catch (err) { console.error(err); }
    };

    const handleSaveSmtp = async () => {
        try {
            const updated = await api.admin.updateSmtp(smtpForm);
            setSmtp(updated);
            setEditingSmtp(false);
        } catch (err) { console.error(err); }
    };

    const handleSendTestEmail = async () => {
        if (!testEmailTo) return;
        setTestEmailLoading(true);
        setTestEmailMsg('');
        try {
            const result = await api.admin.sendTestEmail(testEmailTo);
            setTestEmailMsg(`✅ ${result.message}`);
        } catch (err: any) {
            setTestEmailMsg(`❌ ${err.message || 'Versand fehlgeschlagen'}`);
        } finally {
            setTestEmailLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            const updated = await api.admin.updateConfig(configForm);
            setConfigData(updated);
            setEditingConfig(false);
            setConfigMsg('Konfiguration gespeichert. Server-Neustart für einige Änderungen erforderlich.');
            setTimeout(() => setConfigMsg(''), 5000);
        } catch (err) { console.error(err); }
    };

    const handleResetSystem = async () => {
        if (resetInput !== 'RESET') return;
        setResetting(true);
        try {
            await api.admin.resetSystem();
            localStorage.removeItem('token');
            navigate('/login');
        } catch (err) {
            console.error(err);
            setResetting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const tabs = [
        { id: 'users', label: 'Benutzer', icon: <Users size={16} /> },
        { id: 'smtp', label: 'SMTP', icon: <Mail size={16} /> },
        { id: 'config', label: 'Konfiguration', icon: <Settings size={16} /> },
        { id: 'system', label: 'System', icon: <Database size={16} /> },
    ];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Administration</h1>
                    <p className="page-subtitle">Benutzer- und Systemverwaltung</p>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 'var(--space-xl)' }}>
                {tabs.map(t => (
                    <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ─── Password Reset Popup (Modal) ──── */}
            {resetPasswordPopup && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999,
                }}>
                    <div className="card" style={{ maxWidth: 420, width: '100%', padding: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                            <KeyRound size={20} style={{ color: 'var(--warning)' }} />
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Temporäres Passwort</h3>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                            Neues Passwort für <strong>{resetPasswordPopup.username}</strong>:
                        </p>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                            background: 'var(--bg-base)', padding: 'var(--space-sm) var(--space-md)',
                            borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-lg)',
                        }}>
                            <code style={{
                                flex: 1, fontSize: '1.125rem', letterSpacing: '2px',
                                fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
                                color: 'var(--text-primary)',
                            }}>
                                {resetPasswordPopup.password}
                            </code>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => copyToClipboard(resetPasswordPopup.password)}
                                style={{ flexShrink: 0 }}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Kopiert' : 'Kopieren'}
                            </button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                            Der Benutzer muss das Passwort beim nächsten Login ändern.
                            Dieses Passwort wird nur einmalig angezeigt.
                        </p>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            onClick={() => setResetPasswordPopup(null)}
                        >
                            Schließen
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Users Tab ──────────────── */}
            {activeTab === 'users' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowCreateUser(true)}>
                            <Plus size={14} /> Benutzer erstellen
                        </button>
                    </div>

                    {showCreateUser && (
                        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>Neuer Benutzer</h3>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">Benutzername</label>
                                    <input className="form-input" value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">E-Mail</label>
                                    <input className="form-input" type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Passwort</label>
                                    <input className="form-input" type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Rolle</label>
                                    <select className="form-select" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                                        <option value="user">Benutzer</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowCreateUser(false)}>Abbrechen</button>
                                <button className="btn btn-primary" onClick={handleCreateUser}>Erstellen</button>
                            </div>
                        </div>
                    )}

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Benutzername</th>
                                    <th>E-Mail</th>
                                    <th>Rolle</th>
                                    <th>PW ändern</th>
                                    <th>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td>{u.id}</td>
                                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.username}</td>
                                        <td>{u.email}</td>
                                        <td>
                                            <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                                                {u.role === 'admin' ? 'Admin' : 'Benutzer'}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className={`btn btn-ghost btn-sm`}
                                                onClick={() => handleToggleForceChange(u.id, !!u.must_change_password)}
                                                title={u.must_change_password ? 'Passwortänderung erzwungen – Klicken zum Aufheben' : 'Klicken um Passwortänderung zu erzwingen'}
                                                style={{
                                                    color: u.must_change_password ? 'var(--warning)' : 'var(--text-muted)',
                                                    gap: '0.25rem',
                                                }}
                                            >
                                                {u.must_change_password ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                                                <span style={{ fontSize: '0.75rem' }}>
                                                    {u.must_change_password ? 'Ja' : 'Nein'}
                                                </span>
                                            </button>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                                <button
                                                    className="btn btn-ghost btn-icon btn-sm"
                                                    onClick={() => handleResetPassword(u)}
                                                    title="Passwort zurücksetzen"
                                                >
                                                    <KeyRound size={14} />
                                                </button>
                                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDeleteUser(u.id)} title="Benutzer löschen">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── SMTP Tab ──────────────── */}
            {activeTab === 'smtp' && (
                <div>
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ fontSize: '1rem' }}>SMTP-Konfiguration</h3>
                            {!editingSmtp ? (
                                <button className="btn btn-secondary btn-sm" onClick={() => { setSmtpForm(smtp); setEditingSmtp(true); }}>
                                    <Edit3 size={14} /> Bearbeiten
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingSmtp(false)}><X size={14} /></button>
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveSmtp}><Save size={14} /> Speichern</button>
                                </div>
                            )}
                        </div>

                        {editingSmtp ? (
                            <div className="grid grid-2">
                                {[
                                    { label: 'Host', key: 'host' },
                                    { label: 'Port', key: 'port', type: 'number' },
                                    { label: 'Benutzer', key: 'user' },
                                    { label: 'Passwort', key: 'password', type: 'password' },
                                    { label: 'Absender-Adresse', key: 'from' },
                                ].map(f => (
                                    <div className="form-group" key={f.key}>
                                        <label className="form-label">{f.label}</label>
                                        <input
                                            className="form-input"
                                            type={f.type || 'text'}
                                            value={smtpForm[f.key] ?? ''}
                                            onChange={e => setSmtpForm((s: any) => ({ ...s, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="history-detail-grid">
                                <span>Host:</span><span>{smtp.host || '–'}</span>
                                <span>Port:</span><span>{smtp.port || '–'}</span>
                                <span>Benutzer:</span><span>{smtp.user || '–'}</span>
                                <span>Passwort:</span><span>{smtp.password || '–'}</span>
                                <span>Absender:</span><span>{smtp.from || '–'}</span>
                            </div>
                        )}
                    </div>

                    {/* Test Email Section */}
                    <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>
                            <Send size={16} style={{ marginRight: 'var(--space-xs)', verticalAlign: 'middle' }} />
                            Test-Mail senden
                        </h3>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label className="form-label">Empfänger E-Mail</label>
                                <input
                                    className="form-input"
                                    type="email"
                                    value={testEmailTo}
                                    onChange={e => setTestEmailTo(e.target.value)}
                                    placeholder="test@beispiel.de"
                                />
                            </div>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSendTestEmail}
                                disabled={testEmailLoading || !testEmailTo}
                                style={{ height: 38, whiteSpace: 'nowrap' }}
                            >
                                <Send size={14} />
                                {testEmailLoading ? 'Wird gesendet...' : 'Senden'}
                            </button>
                        </div>
                        {testEmailMsg && (
                            <p style={{
                                fontSize: '0.8125rem', marginTop: 'var(--space-sm)',
                                color: testEmailMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)',
                            }}>
                                {testEmailMsg}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Config Tab ──────────────── */}
            {activeTab === 'config' && configData && (
                <div>
                    {configMsg && (
                        <div className="status-badge badge-success" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-sm) var(--space-md)' }}>
                            {configMsg}
                        </div>
                    )}

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ fontSize: '1rem' }}>Anwendungskonfiguration</h3>
                            {!editingConfig ? (
                                <button className="btn btn-secondary btn-sm" onClick={() => { setConfigForm(JSON.parse(JSON.stringify(configData))); setEditingConfig(true); }}>
                                    <Edit3 size={14} /> Bearbeiten
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingConfig(false)}><X size={14} /></button>
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveConfig}><Save size={14} /> Speichern</button>
                                </div>
                            )}
                        </div>

                        {editingConfig ? (
                            <div>
                                {/* App Name */}
                                <div className="config-section">
                                    <h4 className="config-section-title">Allgemein</h4>
                                    <div className="grid grid-2">
                                        <div className="form-group">
                                            <label className="form-label">App-Name</label>
                                            <input className="form-input" value={configForm.appName ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, appName: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* Server */}
                                <div className="config-section">
                                    <h4 className="config-section-title">Server</h4>
                                    <div className="grid grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Host</label>
                                            <input className="form-input" value={configForm.server?.host ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, server: { ...c.server, host: e.target.value } }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Port</label>
                                            <input className="form-input" type="number" value={configForm.server?.port ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, server: { ...c.server, port: Number(e.target.value) } }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* UDP */}
                                <div className="config-section">
                                    <h4 className="config-section-title">UDP</h4>
                                    <div className="grid grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Port</label>
                                            <input className="form-input" type="number" value={configForm.udp?.port ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, udp: { ...c.udp, port: Number(e.target.value) } }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Aktiviert</label>
                                            <select className="form-select" value={configForm.udp?.enabled ? 'true' : 'false'} onChange={e => setConfigForm((c: any) => ({ ...c, udp: { ...c.udp, enabled: e.target.value === 'true' } }))}>
                                                <option value="true">Ja</option>
                                                <option value="false">Nein</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Auth */}
                                <div className="config-section">
                                    <h4 className="config-section-title">Authentifizierung</h4>
                                    <div className="grid grid-2">
                                        <div className="form-group">
                                            <label className="form-label">JWT Secret</label>
                                            <input className="form-input" value={configForm.auth?.jwtSecret ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, jwtSecret: e.target.value } }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Token-Ablauf</label>
                                            <input className="form-input" value={configForm.auth?.tokenExpiry ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, tokenExpiry: e.target.value } }))} placeholder="z.B. 7d" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Authelia aktiviert</label>
                                            <select className="form-select" value={configForm.auth?.authelia?.enabled ? 'true' : 'false'} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, authelia: { ...c.auth?.authelia, enabled: e.target.value === 'true' } } }))}>
                                                <option value="true">Ja</option>
                                                <option value="false">Nein</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Authelia URL</label>
                                            <input className="form-input" value={configForm.auth?.authelia?.url ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, authelia: { ...c.auth?.authelia, url: e.target.value } } }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* Authentik */}
                                <div className="config-section">
                                    <h4 className="config-section-title">Authentik (SSO / OpenID Connect)</h4>
                                    <div className="grid grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Aktiviert</label>
                                            <select className="form-select" value={configForm.auth?.authentik?.enabled ? 'true' : 'false'} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, authentik: { ...c.auth?.authentik, enabled: e.target.value === 'true' } } }))}>
                                                <option value="true">Ja</option>
                                                <option value="false">Nein</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Issuer URL</label>
                                            <input className="form-input" value={configForm.auth?.authentik?.issuer ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, authentik: { ...c.auth?.authentik, issuer: e.target.value } } }))} placeholder="https://auth.example.com/application/o/serviceheft/" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Client ID</label>
                                            <input className="form-input" value={configForm.auth?.authentik?.clientId ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, authentik: { ...c.auth?.authentik, clientId: e.target.value } } }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Client Secret</label>
                                            <input className="form-input" type="password" value={configForm.auth?.authentik?.clientSecret ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, authentik: { ...c.auth?.authentik, clientSecret: e.target.value } } }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Redirect URI</label>
                                            <input className="form-input" value={configForm.auth?.authentik?.redirectUri ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, auth: { ...c.auth, authentik: { ...c.auth?.authentik, redirectUri: e.target.value } } }))} placeholder="https://serviceheft.example.com/api/auth/callback/authentik" />
                                        </div>
                                    </div>
                                </div>

                                {/* Database */}
                                <div className="config-section">
                                    <h4 className="config-section-title">Datenbank</h4>
                                    <div className="grid grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Typ</label>
                                            <select className="form-select" value={configForm.database?.type ?? 'sqlite'} onChange={e => setConfigForm((c: any) => ({ ...c, database: { ...c.database, type: e.target.value } }))}>
                                                <option value="sqlite">SQLite</option>
                                                <option value="mariadb">MariaDB</option>
                                                <option value="mysql">MySQL</option>
                                                <option value="postgresql">PostgreSQL</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">SQLite-Pfad</label>
                                            <input className="form-input" value={configForm.database?.sqlite?.path ?? ''} onChange={e => setConfigForm((c: any) => ({ ...c, database: { ...c.database, sqlite: { ...c.database?.sqlite, path: e.target.value } } }))} />
                                        </div>
                                    </div>

                                    {(configForm.database?.type === 'mysql' || configForm.database?.type === 'mariadb' || configForm.database?.type === 'postgresql') && (
                                        <div className="grid grid-2" style={{ marginTop: 'var(--space-md)' }}>
                                            {[
                                                { label: 'Host', key: 'host' },
                                                { label: 'Port', key: 'port', type: 'number' },
                                                { label: 'Benutzer', key: 'user' },
                                                { label: 'Passwort', key: 'password', type: 'password' },
                                                { label: 'Datenbank', key: 'database' },
                                            ].map(f => {
                                                const dbType = (configForm.database?.type === 'mariadb' ? 'mysql' : configForm.database?.type) as 'mysql' | 'postgresql';
                                                return (
                                                    <div className="form-group" key={f.key}>
                                                        <label className="form-label">{f.label}</label>
                                                        <input
                                                            className="form-input"
                                                            type={f.type || 'text'}
                                                            value={configForm.database?.[dbType]?.[f.key] ?? ''}
                                                            onChange={e => setConfigForm((c: any) => ({
                                                                ...c,
                                                                database: {
                                                                    ...c.database,
                                                                    [dbType]: {
                                                                        ...c.database?.[dbType],
                                                                        [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                                                                    },
                                                                },
                                                            }))}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div>
                                {/* Read-only view */}
                                <div className="config-section">
                                    <h4 className="config-section-title">Allgemein</h4>
                                    <div className="history-detail-grid">
                                        <span>App-Name:</span><span>{configData.appName}</span>
                                    </div>
                                </div>
                                <div className="config-section">
                                    <h4 className="config-section-title">Server</h4>
                                    <div className="history-detail-grid">
                                        <span>Host:</span><span>{configData.server?.host}</span>
                                        <span>Port:</span><span>{configData.server?.port}</span>
                                    </div>
                                </div>
                                <div className="config-section">
                                    <h4 className="config-section-title">UDP</h4>
                                    <div className="history-detail-grid">
                                        <span>Port:</span><span>{configData.udp?.port}</span>
                                        <span>Aktiviert:</span><span>{configData.udp?.enabled ? 'Ja' : 'Nein'}</span>
                                    </div>
                                </div>
                                <div className="config-section">
                                    <h4 className="config-section-title">Authentifizierung</h4>
                                    <div className="history-detail-grid">
                                        <span>JWT Secret:</span><span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{configData.auth?.jwtSecret}</span>
                                        <span>Token-Ablauf:</span><span>{configData.auth?.tokenExpiry}</span>
                                        <span>Authelia:</span><span>{configData.auth?.authelia?.enabled ? 'aktiv' : 'deaktiviert'}</span>
                                        {configData.auth?.authelia?.url && <><span>Authelia URL:</span><span>{configData.auth.authelia.url}</span></>}
                                    </div>
                                </div>
                                <div className="config-section">
                                    <h4 className="config-section-title">Authentik (SSO)</h4>
                                    <div className="history-detail-grid">
                                        <span>Status:</span><span>{configData.auth?.authentik?.enabled ? 'aktiv' : 'deaktiviert'}</span>
                                        {configData.auth?.authentik?.issuer && <><span>Issuer:</span><span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{configData.auth.authentik.issuer}</span></>}
                                        {configData.auth?.authentik?.clientId && <><span>Client ID:</span><span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{configData.auth.authentik.clientId}</span></>}
                                    </div>
                                </div>
                                <div className="config-section">
                                    <h4 className="config-section-title">Datenbank</h4>
                                    <div className="history-detail-grid">
                                        <span>Typ:</span><span className="badge badge-info">{configData.database?.type}</span>
                                        {configData.database?.type === 'sqlite' && (
                                            <><span>Pfad:</span><span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{configData.database.sqlite?.path}</span></>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── System Tab ─────────────── */}
            {activeTab === 'system' && system && (
                <div>
                    <div className="grid grid-3" style={{ marginBottom: 'var(--space-xl)' }}>
                        {[
                            { label: 'Benutzer', value: system.stats?.users, color: 'var(--info)' },
                            { label: 'Fahrzeuge', value: system.stats?.vehicles, color: 'var(--success)' },
                            { label: 'Wartungseinträge', value: system.stats?.maintenanceRecords, color: 'var(--warning)' },
                        ].map(s => (
                            <div className="card" key={s.label}>
                                <span className="form-label">{s.label}</span>
                                <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="card">
                        <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>Systeminfo</h3>
                        <div className="history-detail-grid">
                            <span>Datenbank:</span><span className="badge badge-info">{system.databaseType}</span>
                            <span>UDP Port:</span><span>{system.udpPort} ({system.udpEnabled ? 'aktiv' : 'deaktiviert'})</span>
                            <span>Authelia:</span><span>{system.autheliEnabled ? 'aktiv' : 'deaktiviert'}</span>
                        </div>
                    </div>

                    <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <UserPlus size={20} style={{ color: system.registrationEnabled ? 'var(--success)' : 'var(--text-muted)' }} />
                                <div>
                                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Benutzer-Registrierung</h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                        Erlaubt neuen Benutzern, sich selbstständig auf der Login-Seite zu registrieren.
                                    </p>
                                </div>
                            </div>
                            <button
                                className={`toggle ${system.registrationEnabled ? 'active' : ''}`}
                                onClick={handleToggleRegistration}
                                aria-label="Toggle registration"
                            />
                        </div>
                    </div>

                    {/* ─── System zurücksetzen ──────── */}
                    <div className="card" style={{ marginTop: 'var(--space-xl)', borderColor: 'var(--danger)', borderWidth: '1px', borderStyle: 'solid' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                            <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
                            <div>
                                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--danger)' }}>System zurücksetzen</h3>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                    Löscht alle Daten unwiderruflich: Datenbank, Benutzerkonten und Einstellungen.
                                </p>
                            </div>
                        </div>

                        {!showResetConfirm ? (
                            <button className="btn btn-danger btn-sm" onClick={() => setShowResetConfirm(true)}>
                                <Trash2 size={14} /> System zurücksetzen
                            </button>
                        ) : (
                            <div style={{ background: 'var(--bg-base)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                                <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                                    Tippen Sie <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>RESET</span> ein, um zu bestätigen:
                                </p>
                                <input
                                    className="form-input"
                                    value={resetInput}
                                    onChange={e => setResetInput(e.target.value)}
                                    placeholder="RESET"
                                    style={{ marginBottom: 'var(--space-sm)', maxWidth: '200px' }}
                                />
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setShowResetConfirm(false); setResetInput(''); }}>Abbrechen</button>
                                    <button className="btn btn-danger btn-sm" onClick={handleResetSystem} disabled={resetInput !== 'RESET' || resetting}>
                                        {resetting ? 'Wird zurückgesetzt...' : 'Endgültig zurücksetzen'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
