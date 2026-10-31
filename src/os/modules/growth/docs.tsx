// Proposals (Basil Media structure, printable), contracts/MoU register, tenders, events and subscribers.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, FileSignature, FileText, Gavel, Plus, Users } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { fetchRows, insertRow, rpc, demoTable, updateRow, usePeople, personName, useTable } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Field, Pill, Sheet, Stat, StageTracker, Tabs, inputCls, tsh, tshShort, type Tone } from '@/os/ui';
import { PageTitle } from '@/os/OsLayout';
import { TENDER_STATUS, daysBetween, dmy, isoPlus, monthKey, monthLabel, renewalBand, todayIso, type Contract, type GrowthEvent, type Instalment, type Proposal, type Tender } from './lib';
import { PrintArea, PrintButton, useSubscribers } from './kit';
import { useCrm } from './crm';

// ---------- settings ----------
export function useVatRate() {
  const [vat, setVat] = useState(18);
  useEffect(() => {
    fetchRows<{ key: string; value: unknown }>('app_settings', { eq: { key: 'vat_rate' } })
      .then((r) => r[0] && setVat(Number(r[0].value) || 18))
      .catch(() => undefined);
  }, []);
  return vat;
}
/** Discount above this needs the boss's approval before a proposal goes out. */
export const DISCOUNT_APPROVAL_PCT = 10;

const BOILER = {
  who_we_are: 'Basil Media is a Dar es Salaam media house telling health, education and finance stories in film, photo, podcast and live stream. We have worked with hospitals, banks, universities and NGOs across Tanzania.',
  how_we_work: 'One account manager, one creative direction and one crew. Brief → pre-production → shoot → edit → two rounds of revisions → final delivery, with approvals in your client portal.',
  why_basil: 'We understand regulated sectors, we deliver in English and Kiswahili, and our references include the National Referral Hospital, Bank Foundation and the Tanzania Health Summit.',
};
export const proposalTotals = (p: Pick<Proposal, 'lines' | 'discount_pct' | 'vat_rate'>) => {
  const sub = p.lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const disc = Math.round((sub * (p.discount_pct || 0)) / 100);
  const net = sub - disc;
  const vat = Math.round((net * p.vat_rate) / 100);
  return { sub, disc, net, vat, total: net + vat };
};
const PSTATUS: Record<Proposal['status'], [string, Tone]> = { draft: ['Draft', 'grey'], awaiting_approval: ['Awaiting boss approval', 'amber'], approved: ['Approved', 'green'], sent: ['Sent', 'blue'], accepted: ['Accepted', 'green'], declined: ['Declined', 'red'] };
export const proposalPill = (s: Proposal['status']) => <Pill tone={PSTATUS[s][1]}>{PSTATUS[s][0]}</Pill>;

export function ProposalsList({ compact = false }: { compact?: boolean }) {
  const { rows } = useTable<Proposal>('proposals', { order: 'created_at', ascending: false });
  const { leads, orgs, orgName } = useCrm();
  const { userId } = useActing();
  const vat = useVatRate();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const [lead, setLead] = useState(params.get('lead') ?? '');
  const create = async () => {
    try {
      const l = leads.find((x) => x.id === lead);
      const org = orgs.find((o) => o.id === l?.organisation_id);
      const n = rows.length + 31;
      const p = await insertRow<Proposal>('proposals', {
        number: `BM-P-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`, lead_id: l?.id ?? null, organisation_id: org?.id ?? null, title: l?.title ?? 'New proposal', client_name: org?.name ?? '', status: 'draft',
        who_we_are: BOILER.who_we_are, who_you_are: org ? `${org.name} is a ${org.type.toLowerCase()} in ${org.city || 'Tanzania'}.` : '', what_we_propose: '', client_gains: '', how_we_work: BOILER.how_we_work, why_basil: BOILER.why_basil,
        lines: [{ name: l?.service || 'Production', amount: l?.value ? Math.round(l.value / (1 + vat / 100)) : 0 }], discount_pct: 0, vat_rate: vat, created_by: userId, sent_at: null,
      });
      nav(`/os/growth/proposals/${p.id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Start from lead"><select className={inputCls} value={lead} onChange={(e) => setLead(e.target.value)}><option value="">— blank —</option>{leads.filter((l) => l.stage !== 'Lost').map((l) => <option key={l.id} value={l.id}>{l.title} · {orgName(l.organisation_id)}</option>)}</select></Field>
        <button type="button" className="btn-primary min-h-[48px]" onClick={create}><Plus size={16} />New proposal</button>
      </div>
      <div className={compact ? 'flex flex-col gap-2' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-3'}>
        {rows.map((p) => (
          <Link key={p.id} to={`/os/growth/proposals/${p.id}`} className="flex flex-col gap-1 rounded-2xl border border-basil-line bg-white p-4 text-basil-ink no-underline hover:shadow-card">
            <span className="flex items-start justify-between gap-2"><b>{p.title}</b>{proposalPill(p.status)}</span>
            <span className="text-sm text-basil-muted">{p.number} · {p.client_name} · {dmy(p.created_at)}</span>
            <span className="font-display font-extrabold">{tsh(proposalTotals(p).total)}<span className="ml-1 text-xs font-normal text-basil-muted">incl. VAT</span></span>
            {p.discount_pct > 0 && <span className="text-xs text-amber-800">Discount {p.discount_pct}%</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
export const ProposalsPage = () => (
  <div><PageTitle tag="GROWTH · PROPOSALS" title="Proposals" sub="Who We Are · Who You Are · What We Are Proposing · What the Client Will Gain · How We Work · Why Basil Media" /><ProposalsList /></div>
);

const SECTIONS: [keyof Proposal, string][] = [['who_we_are', 'Who We Are'], ['who_you_are', 'Who You Are'], ['what_we_propose', 'What We Are Proposing'], ['client_gains', 'What the Client Will Gain'], ['how_we_work', 'How We Work'], ['why_basil', 'Why Basil Media']];

export function ProposalDoc() {
  const { id } = useParams();
  const { rows } = useTable<Proposal>('proposals', { eq: { id } });
  const p = rows[0];
  const { can, userId } = useActing();
  const toast = useToast();
  const [draft, setDraft] = useState<Proposal | null>(null);
  useEffect(() => void (p && setDraft((d) => (d?.id === p.id ? d : structuredClone(p)))), [p]);
  if (!p || !draft) return <Empty title="Proposal not found" />;
  const t = proposalTotals(draft);
  // Once approved, the figures are locked so the approved discount cannot be changed afterwards.
  const editable = p.status === 'draft';
  const save = async (patch: Partial<Proposal> = {}) => {
    try {
      await updateRow('proposals', p.id, { ...draft, ...patch, id: undefined, created_at: undefined });
      toast('Saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const submit = async () => {
    if (draft.discount_pct > DISCOUNT_APPROVAL_PCT) {
      await save({ status: 'awaiting_approval' });
      await notify('u-boss', 'Proposal needs your approval', `${draft.title} · ${draft.discount_pct}% discount · ${tsh(t.total)}`, `/os/growth/proposals/${p.id}`, 'approval');
      toast('Sent to the boss for approval (discount above 10%)');
    } else await save({ status: 'sent', sent_at: new Date().toISOString() });
  };
  const decide = async (ok: boolean) => {
    try {
      await rpc('approve_proposal', { _id: p.id, _approve: ok });
      await notify(p.created_by, ok ? 'Proposal approved' : 'Proposal sent back', p.title, `/os/growth/proposals/${p.id}`, 'approval');
      toast(ok ? 'Approved' : 'Sent back to draft');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const order: Proposal['status'][] = ['draft', 'awaiting_approval', 'sent', 'accepted'];
  const cur = p.status === 'approved' ? 1 : p.status === 'declined' ? 3 : order.indexOf(p.status);
  return (
    <div>
      <PageTitle tag={`PROPOSAL · ${p.number}`} title={p.title} sub={`${p.client_name} · ${dmy(p.created_at)}`}>
        <div className="bm-noprint flex flex-wrap gap-2">
          {editable && <button type="button" className="btn-outline" onClick={() => save()}>Save</button>}
          {editable && p.status === 'draft' && <button type="button" className="btn-primary" onClick={submit}>{draft.discount_pct > DISCOUNT_APPROVAL_PCT ? 'Ask boss to approve' : 'Mark as sent'}</button>}
          {p.status === 'approved' && <button type="button" className="btn-primary" onClick={() => save({ status: 'sent', sent_at: new Date().toISOString() })}>Mark as sent</button>}
          {p.status === 'sent' && <><button type="button" className="btn-primary" onClick={() => save({ status: 'accepted' })}>Client accepted</button><button type="button" className="btn-outline" onClick={() => save({ status: 'declined' })}>Declined</button></>}
          {p.status === 'awaiting_approval' && can('boss') && <><button type="button" className="btn-primary" onClick={() => decide(true)}>Approve</button><button type="button" className="btn-outline" onClick={() => decide(false)}>Send back</button></>}
          <PrintButton label="Print / PDF" />
        </div>
      </PageTitle>
      <div className="bm-noprint mb-4"><StageTracker stages={['Draft', 'Approval', 'Sent', 'Accepted']} current={Math.max(0, cur)} rejected={p.status === 'declined'} /></div>
      <PrintArea>
        <article className="mx-auto max-w-3xl rounded-2xl border border-basil-line bg-white p-6 sm:p-10">
          <header className="mb-6 flex items-start justify-between gap-4 border-b border-basil-line pb-4">
            <div><div className="font-display text-2xl font-extrabold text-basil-deep">Basil Media</div><div className="text-sm text-basil-muted">Mikocheni, Dar es Salaam · hello@basilmedia.co.tz</div></div>
            <div className="text-right text-sm"><b>{p.number}</b><div>{dmy(p.created_at)}</div><div>Prepared for {p.client_name || '—'}</div></div>
          </header>
          {editable ? (
            <div className="bm-noprint mb-4 grid gap-3 sm:grid-cols-2">
              <Field label="Title"><input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
              <Field label="Client"><input className={inputCls} value={draft.client_name} onChange={(e) => setDraft({ ...draft, client_name: e.target.value })} /></Field>
            </div>
          ) : <h1 className="m-0 mb-4 text-2xl font-extrabold">{p.title}</h1>}
          {SECTIONS.map(([k, label], i) => (
            <section key={k} className="mb-5 break-inside-avoid">
              <h2 className="m-0 mb-1 text-lg font-extrabold text-basil-deep">{i + 1}. {label}</h2>
              {editable ? <textarea aria-label={label} className={`${inputCls} bm-noprint h-28 py-2`} value={String(draft[k] ?? '')} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /> : null}
              <p className={`m-0 whitespace-pre-line text-[15px] leading-relaxed ${editable ? 'hidden print:block' : ''}`}>{String(draft[k] ?? '') || '—'}</p>
            </section>
          ))}
          <section className="break-inside-avoid">
            <h2 className="m-0 mb-2 text-lg font-extrabold text-basil-deep">Investment</h2>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-basil-line text-left"><th className="py-2">Item</th><th className="py-2 text-right">TSH</th></tr></thead>
              <tbody>
                {draft.lines.map((l, i) => (
                  <tr key={i} className="border-b border-basil-line/60">
                    <td className="py-2">{editable ? <input aria-label="Item" className={`${inputCls} h-10`} value={l.name} onChange={(e) => setDraft({ ...draft, lines: draft.lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /> : l.name}</td>
                    <td className="w-40 py-2 text-right">{editable ? <input aria-label="Amount" inputMode="numeric" className={`${inputCls} h-10 text-right`} value={l.amount} onChange={(e) => setDraft({ ...draft, lines: draft.lines.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)) })} /> : l.amount.toLocaleString('en-GB')}</td>
                  </tr>
                ))}
                {editable && <tr className="bm-noprint"><td colSpan={2} className="py-2"><button type="button" className="border-0 bg-transparent p-0 text-sm font-bold text-basil" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { name: '', amount: 0 }] })}>+ Add line</button></td></tr>}
                <tr><td className="py-1 text-right text-basil-muted">Subtotal</td><td className="py-1 text-right">{t.sub.toLocaleString('en-GB')}</td></tr>
                {(t.disc > 0 || editable) && <tr><td className="py-1 text-right text-basil-muted">Discount {editable ? <input aria-label="Discount percent" inputMode="numeric" className="bm-noprint ml-1 h-8 w-14 rounded-lg border border-basil-edge px-2 text-right" value={draft.discount_pct} onChange={(e) => setDraft({ ...draft, discount_pct: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) })} /> : draft.discount_pct}%</td><td className="py-1 text-right">−{t.disc.toLocaleString('en-GB')}</td></tr>}
                <tr><td className="py-1 text-right text-basil-muted">VAT {draft.vat_rate}%</td><td className="py-1 text-right">{t.vat.toLocaleString('en-GB')}</td></tr>
                <tr className="font-extrabold"><td className="py-2 text-right">Total incl. VAT</td><td className="py-2 text-right">TSH {t.total.toLocaleString('en-GB')}</td></tr>
              </tbody>
            </table>
            {draft.discount_pct > DISCOUNT_APPROVAL_PCT && <p className="bm-noprint mt-2 flex items-center gap-1 text-sm text-amber-800"><AlertTriangle size={14} />Discounts above {DISCOUNT_APPROVAL_PCT}% need the boss’s approval before sending.</p>}
            <p className="mt-4 text-sm text-basil-muted">Payment: 40% on signing, 25% after the shoot, 20% on first cut, 15% on final delivery. Valid 30 days.</p>
          </section>
        </article>
      </PrintArea>
    </div>
  );
}

// ---------- contracts ----------
const DEFAULT_INST = (start: string): Instalment[] => [['On signing', 40, 0], ['After the shoot', 25, 21], ['On first cut', 20, 35], ['On final delivery', 15, 50]].map(([label, pct, off]) => ({ label: label as string, pct: pct as number, due_date: isoPlus(off as number, new Date(start)), paid: false }));
const KSTATUS: Record<Contract['status'], Tone> = { draft: 'grey', awaiting_signature: 'amber', active: 'green', expired: 'red', terminated: 'red' };

export function useRenewals() {
  const { rows } = useTable<Contract>('contracts');
  return rows.filter((c) => c.status === 'active' && renewalBand(c.end_date) !== null).sort((a, b) => a.end_date.localeCompare(b.end_date));
}

export function ContractsList() {
  const { rows } = useTable<Contract>('contracts', { order: 'end_date' });
  const { orgs, orgName } = useCrm();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Contract> | null>(null);
  const [tab, setTab] = useState<'all' | 'renewals' | 'instalments'>('all');
  const renewals = useRenewals();
  const saveIt = async () => {
    try {
      if (!edit?.title) throw new Error('Title is required');
      const total = (edit.instalments ?? []).reduce((s, i) => s + Number(i.pct), 0);
      if (edit.instalments?.length && total !== 100) throw new Error(`Instalments add up to ${total}% — they must total 100%`);
      const row = { number: edit.number ?? `BM-C-${new Date().getFullYear()}-${String(rows.length + 30).padStart(3, '0')}`, title: edit.title, kind: edit.kind ?? 'Contract', organisation_id: edit.organisation_id ?? null, client_id: orgs.find((o) => o.id === edit.organisation_id)?.client_id ?? edit.client_id ?? null, lead_id: edit.lead_id ?? null, value: Number(edit.value) || 0, start_date: edit.start_date ?? todayIso(), end_date: edit.end_date ?? isoPlus(365), status: edit.status ?? 'draft', instalments: edit.instalments ?? [], renewal_notice_days: Number(edit.renewal_notice_days) || 90, signed_by_name: edit.signed_by_name ?? '', signed_at: edit.signed_at ?? null, signed_user_agent: edit.signed_user_agent ?? '' };
      if (edit.id) await updateRow('contracts', edit.id, row);
      else await insertRow('contracts', row);
      setEdit(null);
      toast('Contract saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const togglePaid = (c: Contract, i: number) => updateRow('contracts', c.id, { instalments: c.instalments.map((x, j) => (j === i ? { ...x, paid: !x.paid } : x)) });
  const list = tab === 'renewals' ? renewals : tab === 'instalments' ? rows.filter((c) => c.instalments.some((i) => !i.paid)) : rows;
  return (
    <div className="flex flex-col gap-3">
      {renewals.length > 0 && (
        <div className="flex flex-col gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {renewals.map((c) => <span key={c.id} className="flex items-center gap-2"><AlertTriangle size={14} /><b>{c.title}</b> · {orgName(c.organisation_id)} ends {dmy(c.end_date)} — {renewalBand(c.end_date)}-day renewal reminder</span>)}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'all', label: 'All', count: rows.length }, { value: 'renewals', label: 'Renewals ≤ 90 days', count: renewals.length }, { value: 'instalments', label: 'Instalments open' }]} />
        <button type="button" className="btn-primary" onClick={() => setEdit({ kind: 'Contract', status: 'draft', start_date: todayIso(), end_date: isoPlus(90), instalments: DEFAULT_INST(todayIso()), renewal_notice_days: 90 })}><Plus size={16} />Contract / MoU</button>
      </div>
      {list.length === 0 && <Empty title="Nothing here" />}
      {list.map((c) => {
        const paid = c.instalments.filter((i) => i.paid).reduce((s, i) => s + i.pct, 0);
        return (
          <Card key={c.id} title={<span className="flex flex-wrap items-center gap-2"><FileSignature size={16} className="text-basil" />{c.title}</span>} action={<button type="button" className="text-sm font-bold text-basil" onClick={() => setEdit(c)}>Edit</button>}>
            <div className="flex flex-wrap gap-1.5 text-sm"><Pill tone="blue">{c.kind}</Pill><Pill tone={KSTATUS[c.status]}>{c.status.replace('_', ' ')}</Pill><span className="text-basil-muted">{c.number} · {orgName(c.organisation_id)} · {dmy(c.start_date)} – {dmy(c.end_date)}</span>{c.value > 0 && <b>{tsh(c.value)}</b>}</div>
            {c.signed_at && <div className="mt-1 text-xs text-basil-muted">Signed by {c.signed_by_name} · {new Date(c.signed_at).toLocaleString('en-GB')}</div>}
            {c.instalments.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {c.instalments.map((i, j) => {
                  const late = !i.paid && !!i.due_date && i.due_date < todayIso();
                  return (
                    <button key={j} type="button" onClick={() => togglePaid(c, j)} className={`flex min-h-[44px] flex-col rounded-xl border p-2 text-left text-xs ${i.paid ? 'border-emerald-200 bg-emerald-50' : late ? 'border-red-200 bg-red-50' : 'border-basil-line bg-white'}`}>
                      <b>{i.pct}% · {i.label}</b><span>{tsh((c.value * i.pct) / 100)}</span><span className="text-basil-muted">{i.paid ? 'Paid' : late ? `Overdue · ${dmy(i.due_date)}` : `Due ${dmy(i.due_date)}`}</span>
                    </button>
                  );
                })}
                <div className="text-xs text-basil-muted sm:col-span-4">{paid}% received · tap an instalment to mark paid / unpaid</div>
              </div>
            )}
          </Card>
        );
      })}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit contract' : 'New contract / MoU'}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="Title"><input className={inputCls} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind"><select className={inputCls} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Contract['kind'] })}><option>Contract</option><option>MoU</option><option>Retainer</option></select></Field>
              <Field label="Status"><select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Contract['status'] })}>{Object.keys(KSTATUS).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></Field>
            </div>
            <Field label="Organisation"><select className={inputCls} value={edit.organisation_id ?? ''} onChange={(e) => setEdit({ ...edit, organisation_id: e.target.value || null })}><option value="">—</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Value (TSH)"><input className={inputCls} inputMode="numeric" value={edit.value ?? 0} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
              <Field label="Start"><input type="date" className={inputCls} value={edit.start_date ?? ''} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} /></Field>
              <Field label="End"><input type="date" className={inputCls} value={edit.end_date ?? ''} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} /></Field>
            </div>
            <Field label="Renewal reminder (days before end)"><input className={inputCls} inputMode="numeric" value={edit.renewal_notice_days ?? 90} onChange={(e) => setEdit({ ...edit, renewal_notice_days: Number(e.target.value) || 0 })} /></Field>
            <b className="text-sm">Instalments</b>
            {(edit.instalments ?? []).map((i, j) => (
              <div key={j} className="grid grid-cols-[1fr_70px_140px] gap-2">
                <input aria-label="Label" className={inputCls} value={i.label} onChange={(e) => setEdit({ ...edit, instalments: edit.instalments!.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })} />
                <input aria-label="Percent" className={inputCls} inputMode="numeric" value={i.pct} onChange={(e) => setEdit({ ...edit, instalments: edit.instalments!.map((x, k) => (k === j ? { ...x, pct: Number(e.target.value) || 0 } : x)) })} />
                <input aria-label="Due date" type="date" className={inputCls} value={i.due_date ?? ''} onChange={(e) => setEdit({ ...edit, instalments: edit.instalments!.map((x, k) => (k === j ? { ...x, due_date: e.target.value } : x)) })} />
              </div>
            ))}
            <div className="flex gap-3 text-sm">
              <button type="button" className="border-0 bg-transparent p-0 font-bold text-basil" onClick={() => setEdit({ ...edit, instalments: DEFAULT_INST(edit.start_date ?? todayIso()) })}>Use 40/25/20/15</button>
              <button type="button" className="border-0 bg-transparent p-0 font-bold text-basil" onClick={() => setEdit({ ...edit, instalments: [] })}>No instalments</button>
            </div>
            <button type="button" className="btn-primary" onClick={saveIt}>Save</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
export const ContractsPage = () => (<div><PageTitle tag="GROWTH · CONTRACTS" title="Contracts & MoU register" sub="Instalments, signatures and renewal reminders at 90 / 60 / 30 days." /><ContractsList /></div>);

// ---------- tenders ----------
const TTONE: Record<string, Tone> = { Identified: 'blue', Preparing: 'amber', Submitted: 'gold', Won: 'green', Lost: 'red', 'Not pursued': 'grey' };
export function TendersList() {
  const { rows } = useTable<Tender>('tenders', { order: 'closes_on' });
  const people = usePeople();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Tender> | null>(null);
  const saveIt = async () => {
    try {
      if (!edit?.title || !edit.closes_on) throw new Error('Title and closing date are required');
      const row = { title: edit.title, issuer: edit.issuer ?? '', reference: edit.reference ?? '', closes_on: edit.closes_on, value_estimate: Number(edit.value_estimate) || 0, status: edit.status ?? 'Identified', owner_id: edit.owner_id ?? 'u-growth', documents_needed: edit.documents_needed ?? '', notes: edit.notes ?? '' };
      if (edit.id) await updateRow('tenders', edit.id, row);
      else await insertRow('tenders', row);
      setEdit(null);
      toast('Tender saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const open = rows.filter((t) => ['Identified', 'Preparing', 'Submitted'].includes(t.status));
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open tenders" value={open.length} />
        <Stat label="Closing in 7 days" value={open.filter((t) => t.status !== 'Submitted' && daysBetween(t.closes_on) >= 0 && daysBetween(t.closes_on) <= 7).length} tone="amber" />
        <Stat label="Open value" value={tshShort(open.reduce((s, t) => s + t.value_estimate, 0))} />
        <Stat label="Win rate" value={`${Math.round((rows.filter((t) => t.status === 'Won').length / Math.max(1, rows.filter((t) => ['Won', 'Lost'].includes(t.status)).length)) * 100)}%`} tone="green" />
      </div>
      <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setEdit({ status: 'Identified', closes_on: isoPlus(14) })}><Plus size={16} />Tender</button></div>
      {rows.map((t) => {
        const days = daysBetween(t.closes_on);
        const urgent = ['Identified', 'Preparing'].includes(t.status) && days >= 0 && days <= 7;
        return (
          <button key={t.id} type="button" onClick={() => setEdit(t)} className={`flex flex-col gap-1 rounded-2xl border bg-white p-4 text-left ${urgent ? 'border-red-300' : 'border-basil-line'}`}>
            <span className="flex flex-wrap items-start justify-between gap-2"><b className="flex items-center gap-2"><Gavel size={16} className="text-basil" />{t.title}</b><Pill tone={TTONE[t.status]}>{t.status}</Pill></span>
            <span className="text-sm text-basil-muted">{t.issuer} · {t.reference} · {tshShort(t.value_estimate)} · owner {personName(people, t.owner_id)}</span>
            <span className={`text-sm ${urgent ? 'font-bold text-red-700' : 'text-basil-muted'}`}>Closes {dmy(t.closes_on)}{days >= 0 ? ` · in ${days} day${days === 1 ? '' : 's'}` : ''}</span>
            {t.documents_needed && <span className="text-xs text-basil-muted">Documents: {t.documents_needed}</span>}
          </button>
        );
      })}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit tender' : 'New tender'}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="Title"><input className={inputCls} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issuer"><input className={inputCls} value={edit.issuer ?? ''} onChange={(e) => setEdit({ ...edit, issuer: e.target.value })} /></Field>
              <Field label="Reference"><input className={inputCls} value={edit.reference ?? ''} onChange={(e) => setEdit({ ...edit, reference: e.target.value })} /></Field>
              <Field label="Closes on"><input type="date" className={inputCls} value={edit.closes_on ?? ''} onChange={(e) => setEdit({ ...edit, closes_on: e.target.value })} /></Field>
              <Field label="Estimated value"><input className={inputCls} inputMode="numeric" value={edit.value_estimate ?? 0} onChange={(e) => setEdit({ ...edit, value_estimate: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
            </div>
            <Field label="Status"><select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Tender['status'] })}>{TENDER_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Documents needed"><textarea className={`${inputCls} h-20 py-2`} value={edit.documents_needed ?? ''} onChange={(e) => setEdit({ ...edit, documents_needed: e.target.value })} /></Field>
            <Field label="Notes"><textarea className={`${inputCls} h-20 py-2`} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <button type="button" className="btn-primary" onClick={saveIt}>Save</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
export const TendersPage = () => (<div><PageTitle tag="GROWTH · TENDERS" title="Tenders tracker" sub="Closing dates, documents and outcomes." /><TendersList /></div>);

// ---------- events ----------
export function EventsList() {
  const { rows } = useTable<GrowthEvent>('growth_events', { order: 'starts_on' });
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<GrowthEvent> | null>(null);
  const [past, setPast] = useState(false);
  const shown = rows.filter((e) => (past ? e.ends_on < todayIso() : e.ends_on >= todayIso()));
  const byMonth = useMemo(() => {
    const m = new Map<string, GrowthEvent[]>();
    shown.forEach((e) => m.set(monthKey(e.starts_on), [...(m.get(monthKey(e.starts_on)) ?? []), e]));
    return [...m.entries()];
  }, [shown]);
  const saveIt = async () => {
    try {
      if (!edit?.title || !edit.starts_on) throw new Error('Title and date are required');
      const row = { title: edit.title, kind: edit.kind ?? 'Conference', starts_on: edit.starts_on, ends_on: edit.ends_on || edit.starts_on, location: edit.location ?? '', role: edit.role ?? 'Attending', owner_id: edit.owner_id ?? 'u-growth', cost: Number(edit.cost) || 0, leads_expected: Number(edit.leads_expected) || 0, notes: edit.notes ?? '' };
      if (edit.id) await updateRow('growth_events', edit.id, row);
      else await insertRow('growth_events', row);
      setEdit(null);
      toast('Event saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={past ? 'past' : 'up'} onChange={(v) => setPast(v === 'past')} items={[{ value: 'up', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />
        <button type="button" className="btn-primary" onClick={() => setEdit({ kind: 'Conference', starts_on: isoPlus(14) })}><Plus size={16} />Event</button>
      </div>
      {byMonth.length === 0 && <Empty icon={<CalendarDays />} title="No events" />}
      {byMonth.map(([m, evs]) => (
        <div key={m} className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-extrabold text-basil-muted">{monthLabel(m)}</h3>
          {evs.map((e) => (
            <button key={e.id} type="button" onClick={() => setEdit(e)} className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left">
              <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-basil-ice font-display leading-none text-basil-deep"><b className="text-lg">{e.starts_on.slice(8, 10)}</b><span className="text-[10px]">{monthLabel(m).slice(0, 3)}</span></span>
              <span className="min-w-0 flex-1"><b className="block">{e.title}</b><span className="text-sm text-basil-muted">{e.kind} · {e.location} · {e.role}</span></span>
              <span className="text-right text-xs text-basil-muted">{e.cost ? tshShort(e.cost) : 'Free'}<br />~{e.leads_expected} leads</span>
            </button>
          ))}
        </div>
      ))}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit event' : 'New event'}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="Title"><input className={inputCls} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind"><select className={inputCls} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{['Conference', 'Networking', 'Workshop', 'Awards', 'Expo'].map((k) => <option key={k}>{k}</option>)}</select></Field>
              <Field label="Our role"><input className={inputCls} value={edit.role ?? ''} onChange={(e) => setEdit({ ...edit, role: e.target.value })} /></Field>
              <Field label="Starts"><input type="date" className={inputCls} value={edit.starts_on ?? ''} onChange={(e) => setEdit({ ...edit, starts_on: e.target.value })} /></Field>
              <Field label="Ends"><input type="date" className={inputCls} value={edit.ends_on ?? ''} onChange={(e) => setEdit({ ...edit, ends_on: e.target.value })} /></Field>
              <Field label="Cost (TSH)"><input className={inputCls} inputMode="numeric" value={edit.cost ?? 0} onChange={(e) => setEdit({ ...edit, cost: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
              <Field label="Leads expected"><input className={inputCls} inputMode="numeric" value={edit.leads_expected ?? 0} onChange={(e) => setEdit({ ...edit, leads_expected: Number(e.target.value) || 0 })} /></Field>
            </div>
            <Field label="Location"><input className={inputCls} value={edit.location ?? ''} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
            <Field label="Notes"><textarea className={`${inputCls} h-20 py-2`} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <button type="button" className="btn-primary" onClick={saveIt}>Save</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
export const EventsPage = () => (<div><PageTitle tag="GROWTH · EVENTS" title="Events calendar" sub="Conferences, networking and awards where we meet buyers." /><EventsList /></div>);

// ---------- subscribers (website table, read-only here) ----------
export function SubscribersGlance() {
  const { rows, error } = useSubscribers();
  if (error) return <Empty title="Subscribers not available" sub={error} />;
  const active = rows.filter((s) => s.status === 'active' || s.status === 'pending');
  const by = (k: 'sector' | 'channel' | 'region') => Object.entries(active.reduce<Record<string, number>>((m, s) => ((m[s[k] || '—'] = (m[s[k] || '—'] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Subscribers" value={active.length} icon={<Users size={16} />} />
        <Stat label="New in 30 days" value={rows.filter((s) => daysBetween(s.created_at) >= -30).length} tone="green" />
      </div>
      {(['sector', 'channel'] as const).map((k) => (
        <Card key={k} title={`By ${k}`}>
          <div className="flex flex-wrap gap-1.5">{by(k).map(([v, n]) => <Pill key={v} tone="blue">{v} · {n}</Pill>)}{by(k).length === 0 && <span className="text-sm text-basil-muted">No subscribers yet.</span>}</div>
        </Card>
      ))}
      <Card title="Latest">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.slice(0, 15).map((s) => <li key={s.id} className="text-sm"><b>{s.title} {s.full_name}</b> <span className="text-basil-muted">· {s.profession} · {s.institution} · {s.channel}</span></li>)}
          {rows.length === 0 && <li className="text-sm text-basil-muted">Nobody has subscribed on the website yet.</li>}
        </ul>
      </Card>
      <Link to="/os/website/subscribers" className="text-sm font-bold"><FileText size={14} className="mr-1 inline" />Manage in Website CMS →</Link>
    </div>
  );
}
