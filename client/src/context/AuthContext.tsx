import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    mustChangePassword: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) { setLoading(false); return; }
            const u = await api.auth.me();
            setUser(u);
        } catch {
            localStorage.removeItem('token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refreshUser(); }, [refreshUser]);

    const login = async (username: string, password: string) => {
        const { token, user: u } = await api.auth.login(username, password);
        localStorage.setItem('token', token);
        setUser(u);
    };

    const register = async (username: string, email: string, password: string) => {
        const { token, user: u } = await api.auth.register(username, email, password);
        localStorage.setItem('token', token);
        setUser(u);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        api.auth.logout().catch(() => { });
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                logout,
                isAuthenticated: !!user,
                isAdmin: user?.role === 'admin',
                mustChangePassword: !!user?.mustChangePassword,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
