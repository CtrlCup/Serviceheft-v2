import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import config from '../../config';
import {
    LayoutDashboard, Settings, Shield, LogOut, Menu, X, Wrench
} from 'lucide-react';
import { useState } from 'react';
import './Layout.css';

export default function Sidebar() {
    const { user, logout, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const links = [
        { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { to: '/settings', icon: <Settings size={20} />, label: 'Einstellungen' },
        ...(isAdmin ? [{ to: '/admin', icon: <Shield size={20} />, label: 'Admin' }] : []),
    ];

    return (
        <>
            <button className="mobile-menu-btn btn-icon btn-ghost" onClick={() => setOpen(true)}>
                <Menu size={24} />
            </button>

            <div className={`sidebar-overlay ${open ? 'active' : ''}`} onClick={() => setOpen(false)} />

            <aside className={`sidebar ${open ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <Wrench size={24} />
                        <span>Serviceheft</span>
                    </div>
                    <button className="sidebar-close btn-icon btn-ghost" onClick={() => setOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {links.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            onClick={() => setOpen(false)}
                            end={link.to === '/'}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user" onClick={() => { navigate('/settings'); setOpen(false); }} style={{ cursor: 'pointer' }}>
                        {user?.avatar ? (
                            <img
                                src={`${config.apiUrl}/${user.avatar}`}
                                alt={user.username}
                                className="sidebar-avatar"
                                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                            />
                        ) : (
                            <div className="sidebar-avatar">{user?.username?.[0]?.toUpperCase()}</div>
                        )}
                        <div className="sidebar-user-info">
                            <span className="sidebar-username">{user?.username}</span>
                            <span className="sidebar-role">{user?.role === 'admin' ? 'Administrator' : 'Benutzer'}</span>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                        <LogOut size={16} />
                        <span>Abmelden</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
