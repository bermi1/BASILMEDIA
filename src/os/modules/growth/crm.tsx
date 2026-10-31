// CRM: organisations & contacts, the leads pipeline, and the website-bookings inbox.
import { useMemo, useState } from 'react';
import { ArrowRight, Building2, CalendarClock, Flame, Inbox, Phone, Plus, Search, UserPlus } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { demoTable, insertRow, newId, nowIso, rpc, updateRow, usePeople, personName, useTable } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Field, Pill, Sheet, Stat, StageTracker, Tabs, inputCls, tshShort } from '@/os/ui';
import type { Booking } from '@/lib/types';
import { LEAD_STAGES, LOST_REASONS, ORG_TYPES, daysBetween, dmy, leadScore, stageTone, todayIso, type Contact, type Lead, type LeadStage, type Organisation, type ShareEvent, type Showcase } from './lib';
import { GoLink, PageHead, markBooking, useBookings, useClients } from './kit';

export function useCrm() {
  const orgs = useTable<Organisation>('crm_organisations', { order: 'name' }).rows;
  const contacts = useTable<Contact>('crm_contacts').rows;
  const leads = useTable<Lead>('leads', { order: 'created_at', ascending: false }).rows;
  const orgName = (id?: string | null) => orgs.find((o) => o.id === id)?.name ?? '—';
  return { orgs, contacts, leads, orgName };
}

/** Lead temperature from share-studio signals on showcases linked to the lead. */
export function useLeadHeat() {
  const shows = useTable<Showcase>('showcases').rows;
  const events = useTable<ShareEvent>('share_events').rows;
  return (leadId: string) => {
    const ids = shows.filter((s) => s.lead_id === leadId).map((s) => s.id);
    return ids.length ? leadScore(events.filter((e) => ids.includes(e.showcase_id))) : null;
  };
}

export async function moveLead(lead: Lead, stage: LeadStage, actor: string, lostReason = '') {
  await rpc('move_lead', { _lead: lead.id, _stage: stage, _lost_reason: lostReason || null }, () => {
    const rows = demoTable('leads');
    const r = rows.find((x) => x.id === lead.id);
    if (!r) throw new Error('Lead not found');
    if (stage === 'Lost' && !lostReason) throw new Error('Choose a lost reason');
    Object.assign(r, { stage, lost_reason: stage === 'Lost' ? lostReason : '', probability: stage === 'Won' ? 100 : stage === 'Lost' ? 0 : r.probability, stage_changed_at: nowIso() });
    demoTable('lead_activity').push({ id: newId(), lead_id: lead.id, kind: 'stage', from_stage: lead.stage, to_stage: stage, body: lostReason, actor_id: actor, created_at: nowIso() });
  });
}

const OPEN = (l: Lead) => l.stage !== 'Won' && l.stage !== 'Lost';
const overdue = (l: Lead) => OPEN(l) && !!l.next_action_date && l.next_action_date < todayIso();

export function LeadCard({ lead, org, onOpen, heat }: { lead: Lead; org: string; onOpen: () => void; heat?: ReturnType<ReturnType<typeof useLeadHeat>> }) {
  const late = overdue(lead);
  return (
    <button type="button" onClick={onOpen} className={`flex w-full flex-col gap-1.5 rounded-2xl border bg-white p-3 text-left ${late ? 'border-red-300 ring-1 ring-red-200' : 'border-basil-line'}`}>
      <span className="flex items-start justify-between gap-2"><b className="text-sm leading-snug">{lead.title}</b>{heat && heat.temp !== 'cold' && <Pill tone={heat.tone}><Flame size={12} />{heat.temp}</Pill>}</span>
      <span className="text-xs text-basil-muted">{org}</span>
      <span className="flex items-center justify-between text-xs"><b>{tshShort(lead.value)}</b><span className="text-basil-muted">{lead.probability}%</span></span>
      {lead.stage === 'Lost' ? <span className="text-xs text-red-700">Lost · {lead.lost_reason || '—'}</span> : lead.next_action && (
        <span className={`flex items-center gap-1 text-xs ${late ? 'font-bold text-red-700' : 'text-basil-muted'}`}><CalendarClock size={12} />{lead.next_action} · {dmy(lead.next_action_date)}{late && ' · overdue'}</span>
      )}
    </button>
  );
}

/** Pipeline: Kanban board on desktop, stage tabs + list on phones. */
export function Pipeline({ compact = false }: { compact?: boolean }) {
  const { orgs, leads, orgName } = useCrm();
  const heat = useLeadHeat();
  const [open, setOpen] = useState<Lead | 'new' | null>(null);
  const [stage, setStage] = useState<LeadStage>('New');
  const [q, setQ] = useState('');
  const shown = leads.filter((l) => !q || `${l.title} ${orgName(l.organisation_id)}`.toLowerCase().includes(q.toLowerCase()));
  const openLeads = leads.filter(OPEN);
  const weighted = openLeads.reduce((s, l) => s + (l.value * l.probability) / 100, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open pipeline" value={tshShort(openLeads.reduce((s, l) => s + l.value, 0))} sub={`${openLeads.length} leads`} />
        <Stat label="Weighted" value={tshShort(weighted)} sub="value × probability" tone="gold" />
        <Stat label="Overdue next actions" value={leads.filter(overdue).length} tone={leads.some(overdue) ? 'red' : 'green'} />
        <Stat label="Won this year" value={tshShort(leads.filter((l) => l.stage === 'Won').reduce((s, l) => s + l.value, 0))} tone="green" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Search leads</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-basil-muted" /><input className={`${inputCls} pl-9`} placeholder="Search leads or organisations" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <button type="button" className="btn-primary" onClick={() => setOpen('new')}><Plus size={16} />New lead</button>
      </div>
      {compact ? (
        <>
          <Tabs value={stage} onChange={setStage} items={LEAD_STAGES.map((s) => ({ value: s, label: s, count: shown.filter((l) => l.stage === s).length }))} />
          <div className="flex flex-col gap-2">
            {shown.filter((l) => l.stage === stage).map((l) => <LeadCard key={l.id} lead={l} org={orgName(l.organisation_id)} heat={heat(l.id)} onOpen={() => setOpen(l)} />)}
            {!shown.some((l) => l.stage === stage) && <Empty title={`No leads in ${stage}`} />}
          </div>
        </>
      ) : (
        <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {LEAD_STAGES.map((s) => {
            const col = shown.filter((l) => l.stage === s);
            return (
              <div key={s} className="flex w-[250px] shrink-0 flex-col gap-2 rounded-2xl bg-basil-mist/60 p-2">
                <div className="flex items-center justify-between px-1"><Pill tone={stageTone(s)}>{s}</Pill><span className="text-xs font-bold text-basil-muted">{col.length} · {tshShort(col.reduce((a, l) => a + l.value, 0))}</span></div>
                {col.map((l) => <LeadCard key={l.id} lead={l} org={orgName(l.organisation_id)} heat={heat(l.id)} onOpen={() => setOpen(l)} />)}
              </div>
            );
          })}
        </div>
      )}
      <LeadSheet lead={open} orgs={orgs} onClose={() => setOpen(null)} />
    </div>
  );
}

export function LeadSheet({ lead, orgs, onClose }: { lead: Lead | 'new' | null; orgs: Organisation[]; onClose: () => void }) {
  const toast = useToast();
  const { userId } = useActing();
  const people = usePeople();
  const isNew = lead === 'new';
  const l = lead && lead !== 'new' ? lead : null;
  const [form, setForm] = useState<Partial<Lead> & { org_name?: string }>({});
  const [lost, setLost] = useState('');
  const key = isNew ? 'new' : l?.id;
  const [loadedKey, setLoadedKey] = useState<string | undefined>();
  if (key !== loadedKey) {
    setLoadedKey(key);
    setForm(l ? { ...l } : { stage: 'New', probability: 10, value: 0, owner_id: userId, source: 'Referral', service: '', next_action: '', next_action_date: todayIso() });
    setLost('');
  }
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const saveIt = async () => {
    try {
      if (!form.title) throw new Error('Give the lead a title');
      let orgId = form.organisation_id;
      if (!orgId && form.org_name) orgId = (await insertRow<Organisation>('crm_organisations', { name: form.org_name, type: 'Corporate', sector: '', client_id: null, city: 'Dar es Salaam', phone: '', email: '', website: '', notes: '' })).id;
      if (!orgId) throw new Error('Choose or name an organisation');
      const row = { title: form.title, organisation_id: orgId, contact_id: form.contact_id ?? null, value: Number(form.value) || 0, probability: Number(form.probability) || 0, next_action: form.next_action ?? '', next_action_date: form.next_action_date || null, owner_id: form.owner_id || userId, source: form.source ?? '', service: form.service ?? '', notes: form.notes ?? '' };
      if (isNew) {
        const created = await insertRow<Lead>('leads', { ...row, stage: 'New', lost_reason: '', booking_id: null, stage_changed_at: nowIso() });
        await insertRow('lead_activity', { lead_id: created.id, kind: 'created', from_stage: null, to_stage: 'New', body: '', actor_id: userId });
      } else await updateRow('leads', l!.id, row);
      toast('Lead saved');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const move = async (s: LeadStage) => {
    try {
      await moveLead(l!, s, userId, lost);
      toast(`Moved to ${s}`);
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const idx = l ? LEAD_STAGES.indexOf(l.stage) : 0;
  return (
    <Sheet open={!!lead} onClose={onClose} title={isNew ? 'New lead' : l?.title ?? ''}>
      <div className="flex flex-col gap-3">
        {l && <StageTracker stages={LEAD_STAGES.slice(0, 6)} current={l.stage === 'Lost' ? 5 : idx} rejected={l.stage === 'Lost'} />}
        <Field label="Title"><input className={inputCls} value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Organisation">
          <select className={inputCls} value={form.organisation_id ?? ''} onChange={(e) => set('organisation_id', e.target.value || undefined)}>
            <option value="">— new organisation —</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        {!form.organisation_id && <Field label="New organisation name"><input className={inputCls} value={form.org_name ?? ''} onChange={(e) => set('org_name', e.target.value)} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Value (TSH)"><input className={inputCls} inputMode="numeric" value={form.value ?? 0} onChange={(e) => set('value', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Probability %"><input className={inputCls} inputMode="numeric" value={form.probability ?? 0} onChange={(e) => set('probability', Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0))} /></Field>
        </div>
        <Field label="Next action"><input className={inputCls} value={form.next_action ?? ''} onChange={(e) => set('next_action', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Next action date"><input type="date" className={inputCls} value={form.next_action_date ?? ''} onChange={(e) => set('next_action_date', e.target.value)} /></Field>
          <Field label="Owner"><select className={inputCls} value={form.owner_id ?? ''} onChange={(e) => set('owner_id', e.target.value)}>{people.filter((p) => !p.roles.includes('client')).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Service"><input className={inputCls} value={form.service ?? ''} onChange={(e) => set('service', e.target.value)} /></Field>
          <Field label="Source"><input className={inputCls} value={form.source ?? ''} onChange={(e) => set('source', e.target.value)} /></Field>
        </div>
        <Field label="Notes"><textarea className={`${inputCls} h-20 py-2`} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        <button type="button" className="btn-primary" onClick={saveIt}>Save lead</button>
        {l && (
          <div className="mt-2 flex flex-col gap-2 border-t border-basil-line pt-3">
            <b className="text-sm">Move to stage</b>
            <div className="flex flex-wrap gap-2">
              {LEAD_STAGES.filter((s) => s !== l.stage && s !== 'Lost').map((s) => <button key={s} type="button" className="btn-outline min-h-[44px]" onClick={() => move(s)}>{s}</button>)}
            </div>
            {l.stage !== 'Lost' && (
              <div className="flex flex-wrap items-end gap-2 [&>label]:min-w-0 [&>label]:flex-1">
                <Field label="Lost reason"><select className={inputCls} value={lost} onChange={(e) => setLost(e.target.value)}><option value="">Choose…</option>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
                <button type="button" className="min-h-[44px] rounded-xl border border-red-300 bg-white px-4 font-bold text-red-700" onClick={() => move('Lost')}>Mark lost</button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <GoLink to={`/os/growth/proposals?lead=${l.id}`} className="btn-outline">Write proposal <ArrowRight size={14} /></GoLink>
              <GoLink to={`/os/share/showcases?lead=${l.id}`} className="btn-outline">Build showcase <ArrowRight size={14} /></GoLink>
              <GoLink to={`/os/share/deals?lead=${l.id}`} className="btn-outline">Open deal room <ArrowRight size={14} /></GoLink>
            </div>
            <span className="text-xs text-basil-muted">Owner {personName(people, l.owner_id)} · created {dmy(l.created_at)}</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** New website bookings → convert into leads. */
export function BookingsInbox() {
  const { rows, error } = useBookings();
  const { orgs } = useCrm();
  const { userId } = useActing();
  const toast = useToast();
  const fresh = rows.filter((b) => b.status === 'new');
  const convert = async (b: Booking) => {
    try {
      const [person, orgPart] = b.name.split('·').map((s) => s.trim());
      const orgNameGuess = orgPart || person;
      let org = orgs.find((o) => o.name.toLowerCase() === orgNameGuess.toLowerCase());
      if (!org) org = await insertRow<Organisation>('crm_organisations', { name: orgNameGuess, type: 'Corporate', sector: '', client_id: null, city: '', phone: '', email: '', website: '', notes: 'From website booking' });
      const email = b.contact.match(/\S+@\S+/)?.[0] ?? '';
      const phone = b.contact.replace(email, '').replace(/[·|]/g, '').trim();
      const contact = await insertRow<Contact>('crm_contacts', { organisation_id: org.id, full_name: person, title: '', phone, email, is_primary: true });
      const lead = await insertRow<Lead>('leads', { title: `${b.service} — ${orgNameGuess}`, organisation_id: org.id, contact_id: contact.id, stage: 'New', value: 0, probability: 10, next_action: 'First call', next_action_date: todayIso(), owner_id: userId, source: 'Website', service: b.service, lost_reason: '', booking_id: b.id, notes: b.message, stage_changed_at: nowIso() });
      await insertRow('lead_activity', { lead_id: lead.id, kind: 'created', from_stage: null, to_stage: 'New', body: 'From website booking', actor_id: userId });
      await markBooking(b, 'contacted');
      toast('Lead created from booking');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  if (error) return <Empty title="Bookings not available" sub={error} />;
  return (
    <div className="flex flex-col gap-2">
      {fresh.length === 0 && <Empty icon={<Inbox />} title="No new website bookings" sub="New bookings from the website appear here." />}
      {fresh.map((b) => (
        <div key={b.id} className="flex flex-col gap-2 rounded-2xl border border-basil-line bg-white p-4">
          <div className="flex items-start justify-between gap-2"><b>{b.name}</b><Pill tone={daysBetween(b.created_at) < -2 ? 'red' : 'amber'}>{Math.max(0, -daysBetween(b.created_at))}d old</Pill></div>
          <span className="text-sm text-basil-muted">{b.service} · {b.source}{b.preferred_date && ` · wants ${dmy(b.preferred_date)}`}</span>
          <p className="m-0 text-sm">{b.message}</p>
          <span className="flex items-center gap-1 text-xs text-basil-muted"><Phone size={12} />{b.contact}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-h-[44px]" onClick={() => convert(b)}><UserPlus size={16} />Convert to lead</button>
            <button type="button" className="btn-outline min-h-[44px]" onClick={() => markBooking(b, 'archived').then(() => toast('Archived'))}>Archive</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Organisations() {
  const { orgs, contacts, leads } = useCrm();
  const clients = useClients();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Organisation> | null>(null);
  const [contact, setContact] = useState<Partial<Contact> | null>(null);
  const shown = useMemo(() => orgs.filter((o) => !q || `${o.name} ${o.type} ${o.city}`.toLowerCase().includes(q.toLowerCase())), [orgs, q]);
  const saveOrg = async () => {
    try {
      if (!edit?.name) throw new Error('Name is required');
      const row = { name: edit.name, type: edit.type ?? 'Corporate', sector: edit.sector ?? '', client_id: edit.client_id || null, city: edit.city ?? '', phone: edit.phone ?? '', email: edit.email ?? '', website: edit.website ?? '', notes: edit.notes ?? '' };
      if (edit.id) await updateRow('crm_organisations', edit.id, row);
      else await insertRow('crm_organisations', row);
      setEdit(null);
      toast('Organisation saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const saveContact = async () => {
    try {
      if (!contact?.full_name || !contact.organisation_id) throw new Error('Name is required');
      const row = { organisation_id: contact.organisation_id, full_name: contact.full_name, title: contact.title ?? '', phone: contact.phone ?? '', email: contact.email ?? '', is_primary: !!contact.is_primary };
      if (contact.id) await updateRow('crm_contacts', contact.id, row);
      else await insertRow('crm_contacts', row);
      setContact(null);
      toast('Contact saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div>
      <PageHead tag="GROWTH · CRM" title="Organisations & contacts" sub="Hospitals, banks, NGOs, universities and government — linked to client records once they buy.">
        <button type="button" className="btn-primary" onClick={() => setEdit({ type: 'Corporate' })}><Plus size={16} />Organisation</button>
      </PageHead>
      <label className="relative mb-4 block"><span className="sr-only">Search</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-basil-muted" /><input className={`${inputCls} pl-9`} placeholder="Search organisations" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((o) => {
          const cs = contacts.filter((c) => c.organisation_id === o.id);
          const ls = leads.filter((l) => l.organisation_id === o.id);
          return (
            <Card key={o.id} title={<span className="flex items-center gap-2"><Building2 size={16} className="text-basil" />{o.name}</span>} action={<button type="button" className="min-h-[44px] rounded-xl border border-basil-line bg-white px-3 text-sm font-bold text-basil" onClick={() => setEdit(o)}>Edit</button>}>
              <div className="mb-2 flex flex-wrap gap-1.5"><Pill tone="blue">{o.type}</Pill>{o.client_id ? <Pill tone="green">Client · {clients.find((c) => c.id === o.client_id)?.name ?? o.client_id}</Pill> : <Pill tone="grey">Prospect</Pill>}{ls.length > 0 && <Pill tone="gold">{ls.length} lead{ls.length > 1 ? 's' : ''} · {tshShort(ls.reduce((s, l) => s + l.value, 0))}</Pill>}</div>
              <div className="text-sm text-basil-muted">{o.city}</div>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                {cs.map((c) => (
                  <li key={c.id}><button type="button" className="min-h-[44px] w-full rounded-lg border-0 bg-transparent p-0 text-left text-sm" onClick={() => setContact(c)}><b>{c.full_name}</b> <span className="text-basil-muted">· {c.title} · {c.phone}</span></button></li>
                ))}
              </ul>
              <button type="button" className="mt-1 min-h-[44px] border-0 bg-transparent p-0 text-sm font-bold text-basil" onClick={() => setContact({ organisation_id: o.id, is_primary: cs.length === 0 })}>+ Contact</button>
            </Card>
          );
        })}
        {shown.length === 0 && <Empty icon={<Building2 />} title={q ? 'No match' : 'No organisations yet'} />}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit organisation' : 'New organisation'}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="Name"><input className={inputCls} value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><select className={inputCls} value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{ORG_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="City"><input className={inputCls} value={edit.city ?? ''} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
            </div>
            <Field label="Linked client record" hint="Link once they become a client so projects, invoices and retainers connect."><select className={inputCls} value={edit.client_id ?? ''} onChange={(e) => setEdit({ ...edit, client_id: e.target.value || null })}><option value="">Not a client yet</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><input className={inputCls} value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
              <Field label="Email"><input className={inputCls} value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><textarea className={`${inputCls} h-20 py-2`} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <button type="button" className="btn-primary" onClick={saveOrg}>Save</button>
          </div>
        )}
      </Sheet>
      <Sheet open={!!contact} onClose={() => setContact(null)} title={contact?.id ? 'Edit contact' : 'New contact'}>
        {contact && (
          <div className="flex flex-col gap-3">
            <Field label="Full name"><input className={inputCls} value={contact.full_name ?? ''} onChange={(e) => setContact({ ...contact, full_name: e.target.value })} /></Field>
            <Field label="Job title"><input className={inputCls} value={contact.title ?? ''} onChange={(e) => setContact({ ...contact, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><input className={inputCls} value={contact.phone ?? ''} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></Field>
              <Field label="Email"><input className={inputCls} value={contact.email ?? ''} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></Field>
            </div>
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!contact.is_primary} onChange={(e) => setContact({ ...contact, is_primary: e.target.checked })} />Primary contact</label>
            <button type="button" className="btn-primary" onClick={saveContact}>Save</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export function PipelinePage() {
  return (
    <div>
      <PageHead tag="GROWTH · PIPELINE" title="Leads pipeline" sub="New → Contacted → Meeting → Proposal Sent → Negotiation → Won / Lost. Red cards have an overdue next action.">
        <GoLink to="/os/growth/inbox" className="btn-outline"><Inbox size={16} />Inbox <ArrowRight size={14} /></GoLink>
      </PageHead>
      <Pipeline />
    </div>
  );
}

export const pipelineTotals = (leads: Lead[]) => {
  const open = leads.filter(OPEN);
  return { count: open.length, value: open.reduce((s, l) => s + l.value, 0), weighted: open.reduce((s, l) => s + (l.value * l.probability) / 100, 0), overdue: leads.filter(overdue) };
};
export { overdue as leadOverdue };
