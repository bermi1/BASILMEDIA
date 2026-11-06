// E-Signature Studio (sidebar "DOCUMENTS"): send documents for signature by link, track, certify, verify.
import { FileSignature } from 'lucide-react';
import { isDemo } from '@/lib/supabase';
import { demoTable } from '@/os/lib/store';
import type { AppRole } from '@/lib/types';
import type { OsModule } from '../types';
import './seed';
import { EsignCertificate, EsignDetail, EsignEditor, EsignList } from './pages';

const ROLES: AppRole[] = ['boss', 'gm_cfo', 'growth', 'account_manager', 'finance'];
const open = () => (isDemo ? demoTable('esign_documents').filter((d) => ['Sent', 'Viewed', 'Partly signed'].includes(String(d.status))).length : 0);

export const esignModule: OsModule = {
  key: 'esign',
  section: 'DOCUMENTS',
  nav: [{ to: '/os/esign', label: 'E-Signature Studio', icon: FileSignature, roles: ROLES, badge: open }],
  routes: [
    { path: 'esign', element: <EsignList /> },
    { path: 'esign/new', element: <EsignEditor /> },
    { path: 'esign/:id', element: <EsignDetail /> },
    { path: 'esign/:id/edit', element: <EsignEditor /> },
    { path: 'esign/:id/certificate', element: <EsignCertificate /> },
  ],
};
