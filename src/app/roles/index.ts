import type { AppRole } from '@/lib/types';
import type { PhoneRoleApp } from '@/os/modules/types';
import { app as boss } from './boss';
import { app as gm_cfo } from './gm_cfo';
import { app as finance } from './finance';
import { app as project_lead } from './project_lead';
import { app as staff } from './staff';
import { app as storekeeper } from './storekeeper';
import { app as growth } from './growth';
import { app as account_manager } from './account_manager';
import { app as receptionist } from './receptionist';
import { app as driver } from './driver';
import { app as client } from './client';

export const PHONE_APPS: Partial<Record<AppRole, PhoneRoleApp>> = {
  boss, gm_cfo, finance, project_lead, staff, storekeeper, growth, account_manager, receptionist, driver, client,
};
