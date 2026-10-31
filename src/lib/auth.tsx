import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { CMS_ROLES, type AppRole } from './types';
import { accessFromRoles, sortPortals, type PortalAccess } from './roles';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /** Roles given directly (user_roles). */
  roles: AppRole[];
  /** Every portal the person can switch between: implied roles (GM ⇒ Finance, Account Manager, Reception),
   *  company-wide or project-limited grants, projects they lead and trips they drive. */
  access: PortalAccess[];
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

/** Plain-language sign-in errors. "Invalid API key" means the site was built with a key that does not
 *  belong to its Supabase project — a hosting setting, not the user's password. */
function friendly(e: { message?: string }): Error {
  const m = e.message ?? String(e);
  if (/invalid api key|no api key|apikey/i.test(m)) {
    const host = (() => { try { return new URL(import.meta.env.VITE_SUPABASE_URL as string).host; } catch { return 'the database'; } })();
    return new Error(`The website's database key is not valid for ${host}. In Vercel → Settings → Environment Variables, set SUPABASE_URL and SUPABASE_ANON_KEY from the same Supabase project (Settings → API), then redeploy.`);
  }
  if (m === 'Invalid login credentials') return new Error('Email or password is not correct.');
  if (/email not confirmed/i.test(m)) return new Error('Please confirm your email first — check your inbox for the link.');
  return new Error(m);
}

async function loadRoles(userId: string): Promise<{ roles: AppRole[]; access: PortalAccess[] }> {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  const roles = (data ?? []).map((r: { role: AppRole }) => r.role);
  const { data: portals, error } = await supabase.rpc('my_portals');
  const access = !error && Array.isArray(portals) && portals.length ? (portals as PortalAccess[]) : accessFromRoles(roles);
  return { roles, access };
}
/** Roles the person effectively holds company-wide (base + implied + company-wide grants). */
export const effectiveRoles = (u: AuthUser | null): AppRole[] =>
  u ? sortPortals([...u.roles, ...u.access.filter((a) => a.project_id === null).map((a) => a.role)]) : [];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apply = async (s: { user: { id: string; email?: string; user_metadata?: { full_name?: string } } } | null) => {
      if (!s) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { roles, access } = await loadRoles(s.user.id);
      setUser({ id: s.user.id, email: s.user.email ?? '', name: s.user.user_metadata?.full_name ?? s.user.email ?? '', roles, access });
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => void apply(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw friendly(error);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) throw friendly(error);
    return { needsConfirm: !data.session };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` });
    if (error) throw friendly(error);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(() => {
    const eff = effectiveRoles(user);
    const hasRole = (...roles: AppRole[]) => !!user && (user.roles.includes('super_admin') || roles.some((r) => eff.includes(r)));
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
