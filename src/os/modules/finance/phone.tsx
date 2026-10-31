// Stable exports used by other roles' phone apps. Implemented by the finance module.
import { Empty } from '@/os/ui';
export function ApprovalsInbox() { return <Empty title="Approvals" sub="Coming with the finance module." />; }
export function MyMoneyRequests() { return <Empty title="My requests" sub="Coming with the finance module." />; }
export function CashGlance() { return null; }
