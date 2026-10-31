import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AppRole } from '@/lib/types';

/** A desktop OS module: its sidebar group and its routes under /os. */
export interface OsModule {
  key: string;
  section: string;
  nav: { to: string; label: string; icon: LucideIcon; roles: AppRole[]; badge?: () => number }[];
  routes: { path: string; element: ReactNode }[];
}

/** A tab in a role's phone app (max 4 per role; the 5th slot is always "More"). */
export interface PhoneTab {
  key: string;
  label: string;
  icon: LucideIcon;
  element: ReactNode;
}
export interface PhoneExtra {
  key: string;
  label: string;
  icon: LucideIcon;
  element: ReactNode;
  sub?: string;
}
export interface PhoneRoleApp {
  title: string;
  /** Portal accent: Boss gold, Finance emerald, Projects sky, Staff violet, Store amber, Growth coral, Client teal. */
  accent: string;
  tabs: PhoneTab[];
  more?: PhoneExtra[];
}
