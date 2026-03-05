import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: number;
}

/**
 * Reusable Modal component.
 * - ESC closes the modal
 * - Enter triggers onSubmit (if provided) unless the focus is in a textarea
 * - Click on backdrop closes the modal
 */
export default function Modal({ isOpen, onClose, onSubmit, title, children, maxWidth = 500 }: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key === 'Enter' && onSubmit) {
                // Don't submit when typing in textareas or when a button is focused
                if (e.target instanceof HTMLTextAreaElement) return;
                if (e.target instanceof HTMLButtonElement) return;
                e.preventDefault();
                onSubmit();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose, onSubmit]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: 'var(--space-md)',
            animation: 'fadeIn 0.2s ease-out'
        }} onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div
                ref={dialogRef}
                className="card"
                style={{
                    width: '100%',
                    maxWidth: maxWidth,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    position: 'relative',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-lg)',
                    paddingBottom: 'var(--space-md)',
                    borderBottom: '1px solid var(--border)'
                }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>{title}</h3>
                    <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; scale: 0.95; }
                    to { transform: translateY(0); opacity: 1; scale: 1; }
                }
            `}
            </style>
        </div>
    );
}
