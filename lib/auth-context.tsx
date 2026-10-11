'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserProfile = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number | null;
  role_name: string | null;
  permissions: string[];
};

type AuthContextType = {
  user: UserProfile | null;
  loading: boolean;
  activeUsername: string;
  hasPermission: (perm: string) => boolean;
  switchUser: (username: string) => Promise<void>;
  availableUsers: { username: string; label: string; role: string }[];
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRESET_USERS = [
  { username: 'admin', label: 'System Admin (Full Access)', role: 'Administrator' },
  { username: 'officer', label: 'Jane Officer (Field Officer)', role: 'Field Officer' },
  { username: 'finance', label: 'Bob Finance (Finance Officer)', role: 'Finance Officer' },
  { username: 'viewer', label: 'Alice Viewer (Read-only)', role: 'Viewer' },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeUsername, setActiveUsername] = useState<string>('admin');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async (username: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/me', {
        headers: { 'X-User': username },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        console.error('Failed to fetch user', res.status);
      }
    } catch (e) {
      console.error('Network error fetching auth', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check saved username in localStorage if available
    const saved = typeof window !== 'undefined' ? localStorage.getItem('fund_user') : null;
    const initial = saved || 'admin';
    setActiveUsername(initial);
    fetchCurrentUser(initial);
  }, []);

  const switchUser = async (username: string) => {
    setActiveUsername(username);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fund_user', username);
    }
    await fetchCurrentUser(username);
  };

  const refreshUser = async () => {
    await fetchCurrentUser(activeUsername);
  };

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeUsername,
        hasPermission,
        switchUser,
        availableUsers: PRESET_USERS,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
