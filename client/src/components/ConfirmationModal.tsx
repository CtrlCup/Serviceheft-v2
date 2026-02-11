import { useState } from 'react';
import Modal from './Modal';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmPhrase: string; // The phrase user must type to confirm (e.g., license plate)
    confirmPhraseLabel?: string;
    isDestructive?: boolean;
    loading?: boolean;
}

export default function ConfirmationModal({
    isOpen, onClose, onConfirm, title, message, confirmPhrase, confirmPhraseLabel = 'Zur Bestätigung eingeben:',
    isDestructive = true, loading = false
}: ConfirmationModalProps) {
    const [input, setInput] = useState('');

    const handleConfirm = () => {
        if (input === confirmPhrase) {
            onConfirm();
            setInput('');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={450}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'start' }}>
                    {isDestructive && (
                        <div style={{
                            padding: 'var(--space-sm)',
                            background: 'var(--danger-bg)',
                            color: 'var(--danger)',
                            borderRadius: '50%',
                            flexShrink: 0
                        }}>
                            <AlertTriangle size={24} />
                        </div>
                    )}
                    <div>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {message}
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: 'var(--space-sm)' }}>
                    <label className="form-label" style={{ fontSize: '0.875rem' }}>
                        {confirmPhraseLabel} <br />
                        <code style={{
                            background: 'var(--bg-secondary)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            userSelect: 'all',
                            fontWeight: 600
                        }}>{confirmPhrase}</code>
                    </label>
                    <input
                        className="form-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={confirmPhrase}
                        autoFocus
                        style={{ marginTop: 'var(--space-xs)' }}
                    />
                </div>

                <div className="modal-actions" style={{ marginTop: 'var(--space-sm)' }}>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Abbrechen
                    </button>
                    <button
                        className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
                        onClick={handleConfirm}
                        disabled={input !== confirmPhrase || loading}
                    >
                        {loading ? 'Laden...' : isDestructive ? <><Trash2 size={16} /> Löschen</> : 'Bestätigen'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
