// Roles → portals. Mirrors supabase/migrations/0011_portal_access.sql:
// - the GM/CFO is also Finance, Account Manager and Reception (and runs logistics/transport);
// - the Boss/GM can give a person an extra portal for the whole company or for ONE project.
import type { AppRole } from './types';

export const IMPLIED_ROLES: Partial<Record<AppRole, AppRole[]>> = {
  gm_cfo: ['finance', 'account_manager', 'receptionist'],
};

/** Order portals appear in switchers. */
export const PORTAL_ORDER: AppRole[] = ['boss', 'gm_cfo', 'finance', 'account_manager', 'growth', 'receptionist', 'project_lead', 'staff', 'storekeeper', 'driver', 'client'];

/** Roles that can be handed out as extra portals (never super_admin/boss/gm_cfo/client). */
export const GRANTABLE: AppRole[] = ['project_lead', 'driver', 'staff', 'storekeeper', 'receptionist', 'finance', 'account_manager', 'growth'];

export interface PortalAccess {
  role: AppRole;
  /** null = whole company; otherwise the project this portal is limited to. */
  project_id: string | null;
  source: 'role' | 'grant' | 'lead' | 'trip';
}

export function expandRoles(base: AppRole[]): AppRole[] {
  const out = new Set<AppRole>();
  for (const r of base) {
    out.add(r);
    for (const x of IMPLIED_ROLES[r] ?? []) out.add(x);
  }
  return sortPortals([...out]);
}

export const sortPortals = (rs: AppRole[]) =>
  [...new Set(rs)].sort((a, b) => (PORTAL_ORDER.indexOf(a) + 1 || 99) - (PORTAL_ORDER.indexOf(b) + 1 || 99));

/** Portal access from base roles (used when the my_portals() function is not available). */
export const accessFromRoles = (base: AppRole[]): PortalAccess[] =>
  expandRoles(base).filter((r) => r !== 'super_admin').map((role) => ({ role, project_id: null, source: 'role' as const }));

/** Project ids a portal is limited to, or null when the person has it company-wide. */
export function projectScope(access: PortalAccess[], role: AppRole): string[] | null {
  const rows = access.filter((a) => a.role === role);
  if (!rows.length || rows.some((a) => a.project_id === null)) return null;
  return rows.map((a) => a.project_id!).filter(Boolean);
}

export const PORTAL_BLURB: Partial<Record<AppRole, string>> = {
  boss: 'Approve money, see cash and risk at a glance',
  gm_cfo: 'Review spend, run payroll, steer the office',
  finance: 'Invoices, proformas, payments and receipts',
  account_manager: 'Clients, retainers, proposals and contracts',
  growth: 'Bookings, leads, showcases and deal rooms',
  receptionist: 'Visitors, parcels, rooms and walk-ins',
  project_lead: 'Stages, crew, budgets and footage backup',
  staff: 'My day, tasks, shoots, leave and payslips',
  storekeeper: 'Gear out and in, kits, stock and repairs',
  driver: 'Trips, vehicle checks and fuel',
  client: 'Your projects, visits, invoices and retainer',
};
