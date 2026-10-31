// Who is acting, and in which portal. The signed-in person always acts as themselves;
// the portal (role) only decides which menu and screens they see. The Super Admin may open every portal.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { AppRole } from '@/lib/types';
import { expandRoles, projectScope, sortPortals } from '@/lib/roles';

interface Acting {
  role: AppRole;
  userId: string;
  roles: AppRole[];
  setRole: (r: AppRole) => void;
  can: (...r: AppRole[]) => boolean;
  /** True if the signed-in user holds any of these roles (desktop menus). */
  canAny: (...r: AppRole[]) => boolean;
  /** Projects the current portal is limited to (a project-only grant), or null for the whole company. */
  scope: string[] | null;
}
const Ctx = createContext<Acting | null>(null);

export const ALL_ROLES: AppRole[] = sortPortals(['boss', 'gm_cfo', 'finance', 'project_lead', 'staff', 'storekeeper', 'growth', 'account_manager', 'receptionist', 'driver', 'client']);

export function ActingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const real = user?.roles ?? [];
  const isSuper = real.includes('super_admin');
  const access = user?.access ?? [];
  const mine = access.length ? sortPortals(access.map((a) => a.role)) : expandRoles(real);
  const roles: AppRole[] = isSuper ? ALL_ROLES : mine;
  const rolesKey = roles.join(',');
  const [role, setRoleState] = useState<AppRole>(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('basil-acting-role')) as AppRole | null;
    return saved && roles.includes(saved) ? saved : roles[0] ?? 'staff';
  });
  const value = useMemo<Acting>(() => {
    const r = roles.includes(role) ? role : roles[0] ?? 'staff';
    return {
      role: r,
      roles,
      userId: user?.id ?? '',
      setRole: (x) => {
        setRoleState(x);
        try {
          localStorage.setItem('basil-acting-role', x);
        } catch {
          /* ignore */
        }
      },
      can: (...rs) => isSuper || rs.includes(r),
      canAny: (...rs) => isSuper || rs.some((x) => roles.includes(x)),
      scope: isSuper ? null : projectScope(access, r),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, rolesKey, isSuper, user?.id, access]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useActing() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useActing outside ActingProvider');
  return c;
}
