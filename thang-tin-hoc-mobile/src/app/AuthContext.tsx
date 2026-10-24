import React, { createContext, useContext, useMemo, useState } from 'react';
import { authService } from '../services/mockService';
import type { DemoUser, UserRole } from '../types';

type AuthContextValue = {
  user: DemoUser | null;
  isSigningIn: boolean;
  signIn: (role: UserRole, phone: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isSigningIn,
    async signIn(role, phone, password) {
      setIsSigningIn(true);
      try {
        setUser(await authService.signIn(role, phone, password));
      } finally {
        setIsSigningIn(false);
      }
    },
    signOut() {
      setUser(null);
    },
  }), [user, isSigningIn]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
