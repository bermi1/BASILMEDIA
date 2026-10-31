import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { CMS_ROLES, type AppRole } from './types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: AppRole[];
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirm: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (...roles: AppRole[]) => boolean;
  canEditWebsite: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

// ---- demo-mode accounts (browser only; never used when Supabase is configured) ----
const DEMO_USERS = 'basil-demo-users-v1';
const DEMO_SESSION = 'basil-demo-session-v1';
type DemoUser = AuthUser & { password: string };
const readUsers = (): DemoUser[] => {
  try {
    return JSON.parse(localStorage.getItem(DEMO_USERS) ?? '[]');
  } catch {
    return [];
  }
};

async function loadRoles(userId: string): Promise<AppRole[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  return (data ?? []).map((r: { role: AppRole }) => r.role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      const email = localStorage.getItem(DEMO_SESSION);
      const u = readUsers().find((x) => x.email === email);
      setUser(u ? { id: u.id, email: u.email, name: u.name, roles: u.roles } : null);
      setLoading(false);
      return;
    }
    const apply = async (s: { user: { id: string; email?: string; user_metadata?: { full_name?: string } } } | null) => {
      if (!s) {
        setUser(null);
        setLoading(false);
        return;
      }
      const roles = await loadRoles(s.user.id);
      setUser({ id: s.user.id, email: s.user.email ?? '', name: s.user.user_metadata?.full_name ?? s.user.email ?? '', roles });
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => void apply(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return;
    }
    const u = readUsers().find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u || u.password !== password) throw new Error('Email or password is not correct.');
    localStorage.setItem(DEMO_SESSION, u.email);
    setUser({ id: u.id, email: u.email, name: u.name, roles: u.roles });
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) throw error;
      return { needsConfirm: !data.session };
    }
    const users = readUsers();
    if (users.some((x) => x.email.toLowerCase() === email.toLowerCase())) throw new Error('That email already has an account.');
    // Same rule as the database trigger: the very first account becomes Super Admin.
    const roles: AppRole[] = users.length === 0 ? ['super_admin'] : [];
    const u: DemoUser = { id: crypto.randomUUID(), email, name: name || email, roles, password };
    localStorage.setItem(DEMO_USERS, JSON.stringify([...users, u]));
    localStorage.setItem(DEMO_SESSION, email);
    setUser({ id: u.id, email, name: u.name, roles });
    return { needsConfirm: false };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(DEMO_SESSION);
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(() => {
    const hasRole = (...roles: AppRole[]) => !!user && (user.roles.includes('super_admin') || roles.some((r) => user.roles.includes(r)));
    return { user, loading, signIn, signUp, resetPassword, signOut, hasRole, canEditWebsite: hasRole(...CMS_ROLES) };
  }, [user, loading, signIn, signUp, resetPassword, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  boss: 'Boss (CEO)',
  gm_cfo: 'GM / CFO',
  finance: 'Finance Officer',
  project_lead: 'Project Lead',
  staff: 'Staff / Crew',
  storekeeper: 'Storekeeper',
  growth: 'Growth',
  account_manager: 'Account Manager',
  receptionist: 'Reception',
  driver: 'Driver',
  client: 'Client',
};
