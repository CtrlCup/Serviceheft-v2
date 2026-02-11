import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import config from '../config';
import { Bell, BellOff, Save, Fingerprint, Trash2, Plus, User, Lock, Camera, X } from 'lucide-react';
import Modal from '../components/Modal';

export default function SettingsPage() {
    const { user, refreshUser } = useAuth();
    const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true);
    const [saving, setSaving] = useState(false);

    // Profile editing
    const [editUsername, setEditUsername] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [profileMsg, setProfileMsg] = useState('');
    const [profileError, setProfileError] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Password change
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwMsg, setPwMsg] = useState('');
    const [pwError, setPwError] = useState('');
    const [savingPw, setSavingPw] = useState(false);

    // Avatar
    const [avatarPreview, setAvatarPreview] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Passkeys
    const [passkeys, setPasskeys] = useState<any[]>([]);
    const [passkeyName, setPasskeyName] = useState('');
    const [passkeyMsg, setPasskeyMsg] = useState('');
    const [passkeyError, setPasskeyError] = useState('');

    useEffect(() => {
        if (user) {
            setNotificationsEnabled(user.notificationsEnabled);
            setEditUsername(user.username);
            setEditEmail(user.email);
            setAvatarPreview(user.avatar ? `${config.apiUrl}/${user.avatar}` : '');
        }
    }, [user]);

    useEffect(() => {
        api.settings.getPasskeys()
            .then(setPasskeys)
            .catch(() => { });
    }, []);

    const handleToggle = async () => {
        setSaving(true);
        try {
            const result = await api.settings.toggleNotifications(!notificationsEnabled);
            setNotificationsEnabled(result.notificationsEnabled);
            await refreshUser();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    // ─── Avatar handlers ────────────────────────
    const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => setAvatarPreview(reader.result as string);
        reader.readAsDataURL(file);

        setUploadingAvatar(true);
        try {
            const result = await api.settings.uploadAvatar(file);
            setAvatarPreview(`${config.apiUrl}/${result.avatar}`);
            await refreshUser();
        } catch (err: any) {
            setProfileError(err.message || 'Avatar-Upload fehlgeschlagen');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleAvatarDelete = async () => {
        try {
            await api.settings.deleteAvatar();
            setAvatarPreview('');
            await refreshUser();
        } catch (err: any) {
            setProfileError(err.message || 'Fehler beim Entfernen');
        }
    };

    // ─── Profile save (username / email only) ───
    const handleProfileSave = async () => {
        setProfileMsg('');
        setProfileError('');

        setSavingProfile(true);
        try {
            const data: Record<string, string> = {};
            if (editUsername !== user?.username) data.username = editUsername;
            if (editEmail !== user?.email) data.email = editEmail;

            if (Object.keys(data).length === 0) {
                setProfileMsg('Keine Änderungen vorhanden');
                setSavingProfile(false);
                return;
            }

            await api.settings.updateProfile(data);
            await refreshUser();
            setProfileMsg('Profil erfolgreich aktualisiert');
        } catch (err: any) {
            setProfileError(err.message || 'Fehler beim Speichern');
        } finally {
            setSavingProfile(false);
        }
    };

    // ─── Password change (separate handler) ─────
    const handlePasswordChange = async () => {
        setPwMsg('');
        setPwError('');

        if (!newPassword) { setPwError('Bitte neues Passwort eingeben'); return; }
        if (newPassword !== confirmPassword) { setPwError('Passwörter stimmen nicht überein'); return; }
        if (newPassword.length < 6) { setPwError('Passwort muss mindestens 6 Zeichen lang sein'); return; }
        if (!currentPassword) { setPwError('Bitte aktuelles Passwort eingeben'); return; }

        setSavingPw(true);
        try {
            await api.settings.updateProfile({ currentPassword, newPassword });
            await refreshUser();
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPwMsg('Passwort erfolgreich geändert');
            setTimeout(() => {
                setShowPasswordModal(false);
                setPwMsg('');
            }, 1000);
        } catch (err: any) {
            setPwError(err.message || 'Fehler beim Ändern');
        } finally {
            setSavingPw(false);
        }
    };

    // ─── Passkey handlers ───────────────────────
    const handleRegisterPasskey = async () => {
        setPasskeyMsg('');
        setPasskeyError('');

        if (!window.PublicKeyCredential) {
            setPasskeyError('Passkeys werden in diesem Browser nicht unterstützt');
            return;
        }

        try {
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: 'Digitales Serviceheft' },
                    user: {
                        id: new TextEncoder().encode(String(user?.id)),
                        name: user?.username || '',
                        displayName: user?.username || '',
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: 'public-key' },
                        { alg: -257, type: 'public-key' },
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                    },
                    timeout: 60000,
                },
            }) as PublicKeyCredential | null;

            if (!credential) {
                setPasskeyError('Passkey-Registrierung abgebrochen');
                return;
            }

            const cred = credential as PublicKeyCredential;
            const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
            const response = cred.response as AuthenticatorAttestationResponse;
            const pubKey = btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey?.() || new ArrayBuffer(0))));

            const updated = await api.settings.registerPasskey({
                credentialId: credId,
                publicKey: pubKey,
                deviceName: passkeyName || undefined,
            });
            setPasskeys(updated);
            setPasskeyName('');
            setPasskeyMsg('Passkey erfolgreich registriert');
        } catch (err: any) {
            setPasskeyError(err.message || 'Passkey-Registrierung fehlgeschlagen');
        }
    };

    const handleDeletePasskey = async (id: string) => {
        try {
            await api.settings.deletePasskey(id);
            setPasskeys(prev => prev.filter(p => p.id !== id));
            setPasskeyMsg('Passkey gelöscht');
        } catch (err: any) {
            setPasskeyError(err.message || 'Fehler beim Löschen');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === 'Enter') {
            action();
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Einstellungen</h1>
                    <p className="page-subtitle">Profil, Sicherheit & Benachrichtigungen</p>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
                gap: 'var(--space-lg)',
                alignItems: 'start',
            }}>
                {/* ═══ LEFT COLUMN ═══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* ─── Notifications ─────────────────── */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                {notificationsEnabled ? <Bell size={20} style={{ color: 'var(--primary)' }} /> : <BellOff size={20} style={{ color: 'var(--text-muted)' }} />}
                                <div>
                                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>E-Mail-Benachrichtigungen</h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                        Erinnerungen für anstehende Wartungen per E-Mail.
                                    </p>
                                </div>
                            </div>
                            <button
                                className={`toggle ${notificationsEnabled ? 'active' : ''}`}
                                onClick={handleToggle}
                                disabled={saving}
                                aria-label="Toggle notifications"
                            />
                        </div>
                    </div>

                    {/* ─── Profile + Avatar ──────────────── */}
                    <div className="card">
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <User size={18} style={{ color: 'var(--primary)' }} />
                            Profil bearbeiten
                        </h3>

                        {/* Avatar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: '50%',
                                        background: avatarPreview ? `url(${avatarPreview}) center/cover` : 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        border: '3px solid var(--border)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Profilbild ändern"
                                >
                                    {!avatarPreview && (user?.username?.[0]?.toUpperCase() || '?')}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: 28,
                                        height: 28,
                                        borderRadius: '50%',
                                        background: 'var(--bg-surface)',
                                        border: '2px solid var(--border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Camera size={14} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleAvatarSelect}
                                />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Profilbild</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                    JPG, PNG, GIF oder WebP. Max 5 MB.
                                </p>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingAvatar}
                                    >
                                        <Camera size={14} />
                                        {uploadingAvatar ? 'Hochladen...' : 'Ändern'}
                                    </button>
                                    {avatarPreview && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={handleAvatarDelete}
                                            style={{ color: 'var(--danger)' }}
                                        >
                                            <X size={14} /> Entfernen
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Username & Email */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="edit-username">Benutzername</label>
                            <input
                                id="edit-username"
                                className="form-input"
                                type="text"
                                value={editUsername}
                                onChange={e => setEditUsername(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, handleProfileSave)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="edit-email">E-Mail</label>
                            <input
                                id="edit-email"
                                className="form-input"
                                type="email"
                                value={editEmail}
                                onChange={e => setEditEmail(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, handleProfileSave)}
                            />
                        </div>

                        <div style={{ marginTop: 'var(--space-sm)' }}>
                            <span className="badge" style={{ fontSize: '0.75rem' }}>
                                Rolle: <span className={`badge ${user?.role === 'admin' ? 'badge-info' : 'badge-success'}`} style={{ marginLeft: 'var(--space-xs)' }}>
                                    {user?.role === 'admin' ? 'Administrator' : 'Benutzer'}
                                </span>
                            </span>
                        </div>

                        {profileMsg && <div className="status-badge badge-success" style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>{profileMsg}</div>}
                        {profileError && <div className="login-error" style={{ marginTop: 'var(--space-md)' }}>{profileError}</div>}

                        <button
                            className="btn btn-primary"
                            style={{ marginTop: 'var(--space-lg)' }}
                            onClick={handleProfileSave}
                            disabled={savingProfile}
                        >
                            <Save size={16} />
                            {savingProfile ? 'Speichern...' : 'Profil speichern'}
                        </button>
                    </div>
                </div>

                {/* ═══ RIGHT COLUMN ═══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* ─── Password Change ───────────────── */}
                    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <Lock size={18} style={{ color: 'var(--primary)' }} />
                                Passwort
                            </h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                Ändern Sie Ihr Passwort regelmäßig.
                            </p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowPasswordModal(true)}
                        >
                            Passwort ändern
                        </button>
                    </div>

                    <Modal
                        isOpen={showPasswordModal}
                        onClose={() => setShowPasswordModal(false)}
                        title="Passwort ändern"
                    >
                        <div className="form-group">
                            <label className="form-label" htmlFor="current-pw">Aktuelles Passwort</label>
                            <input
                                id="current-pw"
                                className="form-input"
                                type="password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, handlePasswordChange)}
                                autoComplete="current-password"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="new-pw">Neues Passwort</label>
                            <input
                                id="new-pw"
                                className="form-input"
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, handlePasswordChange)}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="confirm-pw">Neues Passwort bestätigen</label>
                            <input
                                id="confirm-pw"
                                className="form-input"
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, handlePasswordChange)}
                                autoComplete="new-password"
                            />
                        </div>

                        {pwMsg && <div className="status-badge badge-success" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>{pwMsg}</div>}
                        {pwError && <div className="login-error" style={{ marginBottom: 'var(--space-md)' }}>{pwError}</div>}

                        <div className="modal-actions" style={{ marginTop: 'var(--space-lg)' }}>
                            <button className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                                Abbrechen
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handlePasswordChange}
                                disabled={savingPw}
                            >
                                <Save size={16} />
                                {savingPw ? 'Speichern...' : 'Speichern'}
                            </button>
                        </div>
                    </Modal>

                    {/* ─── Passkey Management ────────────── */}
                    <div className="card">
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <Fingerprint size={18} style={{ color: 'var(--primary)' }} />
                            Passkeys verwalten
                        </h3>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                            Sichere Anmeldung ohne Passwort über Fingerabdruck, Gesichtserkennung oder Sicherheitsschlüssel.
                        </p>

                        {passkeys.length > 0 && (
                            <div style={{ marginBottom: 'var(--space-lg)' }}>
                                {passkeys.map(pk => (
                                    <div key={pk.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: 'var(--space-sm) var(--space-md)',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginBottom: 'var(--space-sm)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            <Fingerprint size={16} style={{ color: 'var(--text-muted)' }} />
                                            <div>
                                                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{pk.device_name}</span>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    Erstellt: {new Date(pk.created_at).toLocaleDateString('de-DE')}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDeletePasskey(pk.id)}
                                            title="Passkey löschen"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {passkeys.length === 0 && (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)', fontStyle: 'italic' }}>
                                Noch keine Passkeys registriert.
                            </p>
                        )}

                        {passkeyMsg && <div className="status-badge badge-success" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>{passkeyMsg}</div>}
                        {passkeyError && <div className="login-error" style={{ marginBottom: 'var(--space-md)' }}>{passkeyError}</div>}

                        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'end' }}>
                            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label className="form-label" htmlFor="passkey-name">Gerätename (optional)</label>
                                <input
                                    id="passkey-name"
                                    className="form-input"
                                    type="text"
                                    value={passkeyName}
                                    onChange={e => setPasskeyName(e.target.value)}
                                    placeholder="z.B. MacBook, iPhone"
                                />
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleRegisterPasskey}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                <Plus size={16} />
                                Passkey registrieren
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
