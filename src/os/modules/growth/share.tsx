// Share Studio: reference library (cleared work), showcase builder with lead signals, and deal rooms.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Copy, ExternalLink, Eye, Flame, Heart, Lock, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { demoTable, insertRow, newId, rpc, updateRow, useTable, usePeople } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Field, Pill, Sheet, Stat, Tabs, inputCls, tshShort } from '@/os/ui';
import { PageTitle } from '@/os/OsLayout';
import { DEAL_STEPS, dmy, isoPlus, leadScore, slugify, type Cta, type DealRoom, type Lead, type Proposal, type ReferenceItem, type ShareEvent, type Showcase } from './lib';
import { ShowcaseView, DealRoomView } from './views';
import { moveLead, useCrm } from './crm';
import type { Contract } from './lib';

const origin = () => (typeof location !== 'undefined' ? location.origin : '');
export const showcaseUrl = (slug: string) => `${origin()}/s/${slug}`;
export const dealUrl = (token: string) => `${origin()}/d/${token}`;
const copy = (text: string, toast: (m: string) => void) => navigator.clipboard?.writeText(text).then(() => toast('Link copied'), () => toast(text));

// ---------- reference library ----------
export function ReferenceLibrary() {
  const { rows } = useTable<ReferenceItem>('reference_items', { order: 'year', ascending: false });
  const { rows: projects } = useTable<{ id: string; name: string; client_id: string; service: string }>('projects');
  const { can, userId } = useActing();
  const toast = useToast();
  const [tab, setTab] = useState<'cleared' | 'pending'>('cleared');
  const [edit, setEdit] = useState<Partial<ReferenceItem> | null>(null);
  const clearer = can('boss', 'gm_cfo');
  const setCleared = async (r: ReferenceItem, cleared: boolean) => {
    try {
      await rpc('set_reference_cleared', { _id: r.id, _cleared: cleared });
      toast(cleared ? 'Cleared for sharing' : 'Removed from sharing');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const saveIt = async () => {
    try {
      if (!edit?.title) throw new Error('Title is required');
      const row = { project_id: edit.project_id ?? null, title: edit.title, client_name: edit.client_name ?? '', sector: edit.sector ?? '', kind: edit.kind ?? 'Film', year: Number(edit.year) || new Date().getFullYear(), thumbnail_url: edit.thumbnail_url ?? '', video_url: edit.video_url ?? '', summary: edit.summary ?? '', results: edit.results ?? '' };
      if (edit.id) await updateRow('reference_items', edit.id, row);
      else {
        await insertRow('reference_items', { ...row, cleared: false, cleared_by: null, cleared_at: null });
        await notify('u-boss', 'Reference waiting to be cleared', row.title, '/os/share', 'approval');
      }
      setEdit(null);
      toast(edit.id ? 'Saved' : 'Added — waiting for boss or GM/CFO to clear it');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const list = rows.filter((r) => (tab === 'cleared' ? r.cleared : !r.cleared));
  return (
    <div>
      <PageTitle tag="SHARE STUDIO" title="Reference library" sub="Only work cleared for sharing by the Boss or GM/CFO can go into a showcase.">
        <div className="flex gap-2"><Link to="/os/share/showcases" className="btn-outline"><Sparkles size={16} />Showcases</Link><button type="button" className="btn-primary" onClick={() => setEdit({ kind: 'Film', year: new Date().getFullYear() })}><Plus size={16} />Add reference</button></div>
      </PageTitle>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'cleared', label: 'Cleared for sharing', count: rows.filter((r) => r.cleared).length }, { value: 'pending', label: 'Not cleared', count: rows.filter((r) => !r.cleared).length }]} />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <Card key={r.id} title={r.title} action={<button type="button" className="text-sm font-bold text-basil" onClick={() => setEdit(r)}>Edit</button>}>
            <div className="mb-2 flex flex-wrap gap-1.5"><Pill tone="blue">{r.kind}</Pill><Pill tone="grey">{r.sector} · {r.year}</Pill>{r.cleared ? <Pill tone="green"><ShieldCheck size={12} />Cleared</Pill> : <Pill tone="amber"><Lock size={12} />Not cleared</Pill>}</div>
            <p className="m-0 text-sm text-basil-muted">{r.client_name}</p>
            <p className="m-0 mt-1 text-sm">{r.summary}</p>
            {r.results && <p className="m-0 mt-1 text-sm font-bold text-emerald-700">{r.results}</p>}
            {clearer && <button type="button" className={`mt-3 min-h-[44px] ${r.cleared ? 'btn-outline' : 'btn-primary'}`} onClick={() => setCleared(r, !r.cleared)}>{r.cleared ? 'Withdraw clearance' : 'Clear for sharing'}</button>}
          </Card>
        ))}
        {list.length === 0 && <Empty title="Nothing here" />}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit reference' : 'Add reference'}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="From project (optional)"><select className={inputCls} value={edit.project_id ?? ''} onChange={(e) => { const p = projects.find((x) => x.id === e.target.value); setEdit({ ...edit, project_id: p?.id ?? null, title: edit.title || p?.name, kind: edit.kind || p?.service }); }}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Title"><input className={inputCls} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client (as shown)"><input className={inputCls} value={edit.client_name ?? ''} onChange={(e) => setEdit({ ...edit, client_name: e.target.value })} /></Field>
              <Field label="Sector"><input className={inputCls} value={edit.sector ?? ''} onChange={(e) => setEdit({ ...edit, sector: e.target.value })} /></Field>
              <Field label="Kind"><select className={inputCls} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{['Film', 'Photo story', 'Podcast', 'Live stream', 'Event'].map((k) => <option key={k}>{k}</option>)}</select></Field>
              <Field label="Year"><input className={inputCls} inputMode="numeric" value={edit.year ?? ''} onChange={(e) => setEdit({ ...edit, year: Number(e.target.value) || 0 })} /></Field>
            </div>
            <Field label="Video / gallery link"><input className={inputCls} value={edit.video_url ?? ''} onChange={(e) => setEdit({ ...edit, video_url: e.target.value })} /></Field>
            <Field label="Thumbnail URL"><input className={inputCls} value={edit.thumbnail_url ?? ''} onChange={(e) => setEdit({ ...edit, thumbnail_url: e.target.value })} /></Field>
            <Field label="Summary"><textarea className={`${inputCls} h-20 py-2`} value={edit.summary ?? ''} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></Field>
            <Field label="Results"><input className={inputCls} value={edit.results ?? ''} onChange={(e) => setEdit({ ...edit, results: e.target.value })} /></Field>
            <button type="button" className="btn-primary" onClick={saveIt}>Save</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

// ---------- showcases ----------
export function useSignals() {
  const events = useTable<ShareEvent>('share_events', { order: 'created_at', ascending: false }).rows;
  return (showcaseId: string) => {
    const ev = events.filter((e) => e.showcase_id === showcaseId);
    return { ev, views: ev.filter((e) => e.kind === 'view').length, likes: ev.filter((e) => e.kind === 'like').length, needs: ev.filter((e) => e.kind === 'need').length, ctas: ev.filter((e) => e.kind === 'cta').length, ...leadScore(ev), last: ev[0]?.created_at };
  };
}

export function ShowcasesList({ compact = false }: { compact?: boolean }) {
  const { rows } = useTable<Showcase>('showcases', { order: 'created_at', ascending: false });
  const { orgName, leads } = useCrm();
  const signals = useSignals();
  const { userId } = useActing();
  const people = usePeople();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const create = async () => {
    const lead = leads.find((l) => l.id === params.get('lead'));
    const me = people.find((p) => p.id === userId);
    const title = lead ? `Work for ${orgName(lead.organisation_id)}` : 'New showcase';
    const s = await insertRow<Showcase>('showcases', {
      slug: `${slugify(title)}-${newId().slice(0, 4)}`, title, mode: 'showcase', recipient_name: '', organisation_id: lead?.organisation_id ?? null, lead_id: lead?.id ?? null, welcome: '', item_ids: [],
      ctas: [{ label: 'Chat on WhatsApp', kind: 'whatsapp', url: `https://wa.me/${(me?.phone ?? '+255712000010').replace(/\D/g, '')}` }, { label: 'Book a 20-minute call', kind: 'book', url: '/contact' }],
      contact: { name: me?.full_name ?? 'Basil Media', role: 'Account Manager', phone: me?.phone ?? '', email: '', whatsapp: me?.phone ?? '' }, published: false, expires_on: isoPlus(30), created_by: userId,
    });
    nav(`/os/share/showcases/${s.id}`);
  };
  return (
    <div className="flex flex-col gap-3">
      {!compact && <div className="flex justify-end"><button type="button" className="btn-primary" onClick={create}><Plus size={16} />New showcase</button></div>}
      {rows.map((s) => {
        const g = signals(s.id);
        return (
          <div key={s.id} className="flex flex-col gap-2 rounded-2xl border border-basil-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0"><b className="block">{s.title}</b><span className="text-sm text-basil-muted">{s.mode === 'linktree' ? 'Link tree' : 'Showcase'} · {s.item_ids.length} items{s.organisation_id ? ` · ${orgName(s.organisation_id)}` : ''}</span></span>
              <span className="flex flex-wrap gap-1.5">{s.published ? <Pill tone="green">Live</Pill> : <Pill tone="grey">Draft</Pill>}<Pill tone={g.tone}><Flame size={12} />{g.temp} · {g.score}</Pill></span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-basil-muted"><span><Eye size={13} className="mr-1 inline" />{g.views} views</span><span><Heart size={13} className="mr-1 inline" />{g.likes} likes</span><span><Sparkles size={13} className="mr-1 inline" />{g.needs} “I need this”</span><span>{g.ctas} CTA taps</span>{g.last && <span>last {dmy(g.last)}</span>}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline min-h-[44px]" onClick={() => copy(showcaseUrl(s.slug), toast)}><Copy size={15} />Copy link</button>
              <a href={`/s/${s.slug}`} target="_blank" rel="noreferrer" className="btn-outline min-h-[44px]"><ExternalLink size={15} />Open</a>
              {!compact && <Link to={`/os/share/showcases/${s.id}`} className="btn-primary min-h-[44px]">Edit</Link>}
              {compact && s.contact.whatsapp && <a className="btn-primary min-h-[44px]" href={`https://wa.me/?text=${encodeURIComponent(`${s.title} — ${showcaseUrl(s.slug)}`)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
            </div>
          </div>
        );
      })}
      {rows.length === 0 && <Empty title="No showcases yet" />}
    </div>
  );
}
export const ShowcasesPage = () => (<div><PageTitle tag="SHARE STUDIO" title="Showcases" sub="Personalised pages of 1–12 cleared references. Views and reactions become lead signals (cold / warm / hot)." /><ShowcasesList /></div>);

export function ShowcaseBuilder() {
  const { id } = useParams();
  const { rows } = useTable<Showcase>('showcases', { eq: { id } });
  const { rows: refs } = useTable<ReferenceItem>('reference_items', { eq: { cleared: true } });
  const { orgs, leads } = useCrm();
  const signals = useSignals();
  const toast = useToast();
  const nav = useNavigate();
  const [s, setS] = useState<Showcase | null>(null);
  useEffect(() => void (rows[0] && setS((x) => (x?.id === rows[0].id ? x : structuredClone(rows[0])))), [rows]);
  const picked = useMemo(() => (s ? s.item_ids.map((i) => refs.find((r) => r.id === i)).filter(Boolean) as ReferenceItem[] : []), [s, refs]);
  if (!s) return <Empty title="Showcase not found" />;
  const toggle = (rid: string) => {
    if (s.item_ids.includes(rid)) setS({ ...s, item_ids: s.item_ids.filter((x) => x !== rid) });
    else if (s.item_ids.length >= 12) toast('A showcase holds at most 12 items', 'error');
    else setS({ ...s, item_ids: [...s.item_ids, rid] });
  };
  const save = async (publish?: boolean) => {
    try {
      if (!s.item_ids.length) throw new Error('Pick at least one item');
      const slug = slugify(s.slug) || slugify(s.title);
      await updateRow('showcases', s.id, { ...s, slug, published: publish ?? s.published, id: undefined, created_at: undefined });
      toast(publish ? 'Published — link ready to share' : 'Saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const setCta = (i: number, patch: Partial<Cta>) => setS({ ...s, ctas: s.ctas.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const g = signals(s.id);
  return (
    <div>
      <PageTitle tag="SHARE STUDIO · SHOWCASE BUILDER" title={s.title} sub={showcaseUrl(s.slug)}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => copy(showcaseUrl(s.slug), toast)}><Copy size={16} />Copy link</button>
          <button type="button" className="btn-outline" onClick={() => save()}>Save</button>
          <button type="button" className="btn-primary" onClick={() => save(!s.published)}>{s.published ? 'Unpublish' : 'Publish'}</button>
        </div>
      </PageTitle>
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="flex flex-col gap-4">
          <Card title="Details">
            <div className="flex flex-col gap-3">
              <Tabs value={s.mode} onChange={(mode) => setS({ ...s, mode })} items={[{ value: 'showcase', label: 'Showcase mode' }, { value: 'linktree', label: 'Link tree mode' }]} />
              <Field label="Title"><input className={inputCls} value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} /></Field>
              <Field label="Link" hint="basilmedia.co.tz/s/…"><input className={inputCls} value={s.slug} onChange={(e) => setS({ ...s, slug: e.target.value })} /></Field>
              <Field label="Prepared for"><input className={inputCls} value={s.recipient_name} onChange={(e) => setS({ ...s, recipient_name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Organisation"><select className={inputCls} value={s.organisation_id ?? ''} onChange={(e) => setS({ ...s, organisation_id: e.target.value || null })}><option value="">—</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
                <Field label="Lead"><select className={inputCls} value={s.lead_id ?? ''} onChange={(e) => setS({ ...s, lead_id: e.target.value || null })}><option value="">—</option>{leads.filter((l) => !s.organisation_id || l.organisation_id === s.organisation_id).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></Field>
              </div>
              <Field label="Personal welcome"><textarea className={`${inputCls} h-24 py-2`} value={s.welcome} onChange={(e) => setS({ ...s, welcome: e.target.value })} /></Field>
              <Field label="Available until"><input type="date" className={inputCls} value={s.expires_on ?? ''} onChange={(e) => setS({ ...s, expires_on: e.target.value || null })} /></Field>
            </div>
          </Card>
          <Card title={`Pick items (${s.item_ids.length}/12)`}>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {refs.map((r) => {
                const on = s.item_ids.includes(r.id);
                return (
                  <li key={r.id}><label className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 ${on ? 'border-basil bg-basil-ice' : 'border-basil-line bg-white'}`}><input type="checkbox" checked={on} onChange={() => toggle(r.id)} /><span className="min-w-0 flex-1 text-sm"><b>{r.title}</b><span className="block text-xs text-basil-muted">{r.kind} · {r.client_name}</span></span>{on && <span className="text-xs font-bold text-basil">#{s.item_ids.indexOf(r.id) + 1}</span>}</label></li>
                );
              })}
            </ul>
          </Card>
          <Card title="Contact card & buttons">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name"><input className={inputCls} value={s.contact.name} onChange={(e) => setS({ ...s, contact: { ...s.contact, name: e.target.value } })} /></Field>
                <Field label="Role"><input className={inputCls} value={s.contact.role} onChange={(e) => setS({ ...s, contact: { ...s.contact, role: e.target.value } })} /></Field>
                <Field label="Phone"><input className={inputCls} value={s.contact.phone} onChange={(e) => setS({ ...s, contact: { ...s.contact, phone: e.target.value } })} /></Field>
                <Field label="Email"><input className={inputCls} value={s.contact.email} onChange={(e) => setS({ ...s, contact: { ...s.contact, email: e.target.value } })} /></Field>
              </div>
              {s.ctas.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_44px] gap-2">
                  <input aria-label="Button label" className={inputCls} value={c.label} onChange={(e) => setCta(i, { label: e.target.value })} />
                  <select aria-label="Button type" className={inputCls} value={c.kind} onChange={(e) => setCta(i, { kind: e.target.value as Cta['kind'] })}>{['whatsapp', 'call', 'email', 'book', 'link'].map((k) => <option key={k}>{k}</option>)}</select>
                  <button type="button" aria-label="Remove button" className="flex items-center justify-center rounded-xl border border-basil-line bg-white text-red-700" onClick={() => setS({ ...s, ctas: s.ctas.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
                  <input aria-label="Button link" className={`${inputCls} col-span-3`} value={c.url} onChange={(e) => setCta(i, { url: e.target.value })} />
                </div>
              ))}
              {s.ctas.length < 4 && <button type="button" className="border-0 bg-transparent p-0 text-left text-sm font-bold text-basil" onClick={() => setS({ ...s, ctas: [...s.ctas, { label: 'Call us', kind: 'call', url: `tel:${s.contact.phone}` }] })}>+ Button</button>}
            </div>
          </Card>
          <Card title="Lead signals">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Views" value={g.views} /><Stat label="Reactions" value={g.likes + g.needs} /><Stat label="CTA taps" value={g.ctas} /><Stat label="Lead score" value={`${g.temp} · ${g.score}`} tone={g.tone === 'red' ? 'red' : g.tone === 'amber' ? 'amber' : undefined} />
            </div>
            <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 text-sm">
              {g.ev.slice(0, 8).map((e) => <li key={e.id} className="text-basil-muted">{new Date(e.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })} · <b className="text-basil-ink">{e.kind === 'need' ? '“I need something like this”' : e.kind === 'like' ? '“I like this”' : e.kind}</b>{e.item_id && ` · ${refs.find((r) => r.id === e.item_id)?.title ?? ''}`}</li>)}
            </ul>
            {s.lead_id && g.temp === 'hot' && <button type="button" className="btn-primary mt-3" onClick={() => nav(`/os/share/deals?lead=${s.lead_id}`)}>Hot lead — open a deal room</button>}
          </Card>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-basil-line bg-[#F3F7FC]">
          <div className="border-b border-basil-line bg-white px-4 py-2 text-xs font-bold text-basil-muted">PREVIEW · {s.mode === 'linktree' ? 'Link tree' : 'Showcase'}</div>
          <ShowcaseView showcase={s} items={picked} onReact={() => undefined} />
        </div>
      </div>
    </div>
  );
}

// ---------- deal rooms ----------
export function DealsList({ compact = false }: { compact?: boolean }) {
  const { rows } = useTable<DealRoom>('deal_rooms', { order: 'created_at', ascending: false });
  const { leads, orgName } = useCrm();
  const { rows: proposals } = useTable<Proposal>('proposals');
  const { rows: shows } = useTable<Showcase>('showcases');
  const { userId } = useActing();
  const [params] = useSearchParams();
  const [lead, setLead] = useState(params.get('lead') ?? '');
  const nav = useNavigate();
  const toast = useToast();
  const serious = leads.filter((l) => ['Meeting', 'Proposal Sent', 'Negotiation'].includes(l.stage));
  const create = async () => {
    const l = leads.find((x) => x.id === lead);
    if (!l) return toast('Choose a lead', 'error');
    const existing = rows.find((d) => d.lead_id === l.id);
    if (existing) return nav(`/os/share/deals/${existing.id}`);
    const prop = proposals.find((p) => p.lead_id === l.id);
    const sh = shows.find((s) => s.lead_id === l.id);
    const d = await insertRow<DealRoom>('deal_rooms', {
      token: `${slugify(orgName(l.organisation_id)).slice(0, 20)}-${newId().replace(/-/g, '').slice(0, 8)}`, lead_id: l.id, title: l.title, client_name: orgName(l.organisation_id), value: l.value, showcase_id: sh?.id ?? null, proposal_id: prop?.id ?? null, quotation_url: '',
      contract_id: null, contract_terms: '1. Scope. As in the proposal.\n2. Fees. Payable 40% on signing, 25% after the shoot, 20% on first cut, 15% on final delivery.\n3. Revisions. Two rounds per deliverable.\n4. Rights. Usage rights pass to the Client on full payment.\n5. Data. Personal data handled under the Tanzania Personal Data Protection Act, 2022.',
      deposit_pct: 40, deposit_paid_at: null, kickoff_at: null, step: sh ? (prop ? 2 : 1) : 0, signed_name: '', signed_at: null, signed_user_agent: '', prepared_by: userId, expires_on: isoPlus(30),
    });
    nav(`/os/share/deals/${d.id}`);
  };
  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Serious lead"><select className={inputCls} value={lead} onChange={(e) => setLead(e.target.value)}><option value="">Choose…</option>{serious.map((l) => <option key={l.id} value={l.id}>{l.title} · {orgName(l.organisation_id)}</option>)}</select></Field>
          <button type="button" className="btn-primary min-h-[48px]" onClick={create}><Plus size={16} />Open deal room</button>
        </div>
      )}
      {rows.map((d) => {
        const pct = Math.round((Math.min(d.step, 6) / 6) * 100);
        return (
          <Link key={d.id} to={`/os/share/deals/${d.id}`} className="flex flex-col gap-2 rounded-2xl border border-basil-line bg-white p-4 text-basil-ink no-underline">
            <span className="flex flex-wrap items-start justify-between gap-2"><b>{d.title}</b><Pill tone={d.step >= 6 ? 'green' : d.step >= 3 ? 'amber' : 'blue'}>{d.step >= 6 ? 'Kicked off' : DEAL_STEPS[d.step]}</Pill></span>
            <span className="text-sm text-basil-muted">{d.client_name} · {tshShort(d.value)}</span>
            <div className="h-2 overflow-hidden rounded-full bg-basil-line"><div className="h-full rounded-full bg-basil" style={{ width: `${pct}%` }} /></div>
          </Link>
        );
      })}
      {rows.length === 0 && <Empty title="No deal rooms yet" />}
    </div>
  );
}
export const DealsPage = () => (<div><PageTitle tag="SHARE STUDIO · DEAL ROOMS" title="Deal rooms" sub="Showcase → proposal → quotation → contract sign → deposit → kick-off, on one private page per serious lead." /><DealsList /></div>);

export function DealRoomAdmin() {
  const { id } = useParams();
  const { rows } = useTable<DealRoom>('deal_rooms', { eq: { id } });
  const d = rows[0];
  const { rows: proposals } = useTable<Proposal>('proposals');
  const { rows: contracts } = useTable<Contract>('contracts');
  const { rows: shows } = useTable<Showcase>('showcases');
  const { leads } = useCrm();
  const { userId } = useActing();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [kick, setKick] = useState('');
  if (!d) return <Empty title="Deal room not found" />;
  const proposal = proposals.find((p) => p.id === d.proposal_id) ?? null;
  const contract = contracts.find((c) => c.id === d.contract_id) ?? null;
  const show = shows.find((s) => s.id === d.showcase_id);
  const patch = async (p: Partial<DealRoom>, msg: string) => {
    try {
      await updateRow('deal_rooms', d.id, p);
      toast(msg);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const kickoff = async () => {
    if (!kick) return toast('Choose the kick-off date and time', 'error');
    await patch({ kickoff_at: new Date(kick).toISOString(), step: 6 }, 'Kick-off booked');
    const l = leads.find((x) => x.id === d.lead_id) as Lead | undefined;
    if (l && l.stage !== 'Won') await moveLead(l, 'Won', userId).catch(() => undefined);
    await notify('u-boss', 'Deal won', `${d.client_name} · ${d.title} · ${tshShort(d.value)}`, `/os/share/deals/${d.id}`, 'info');
  };
  return (
    <div>
      <PageTitle tag="DEAL ROOM" title={d.client_name} sub={d.title}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => copy(dealUrl(d.token), toast)}><Copy size={16} />Copy client link</button>
          <a className="btn-outline" href={`/d/${d.token}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />Client view</a>
        </div>
      </PageTitle>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <DealRoomView deal={d} proposal={proposal} contract={contract} showcaseSlug={show?.slug ?? null} internal />
        <div className="flex flex-col gap-3">
          <Card title="Move the deal forward">
            <div className="flex flex-col gap-3 text-sm">
              <Field label="Showcase"><select className={inputCls} value={d.showcase_id ?? ''} onChange={(e) => patch({ showcase_id: e.target.value || null, step: Math.max(d.step, e.target.value ? 1 : 0) }, 'Showcase linked')}><option value="">—</option>{shows.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></Field>
              <Field label="Proposal"><select className={inputCls} value={d.proposal_id ?? ''} onChange={(e) => patch({ proposal_id: e.target.value || null, step: Math.max(d.step, e.target.value ? 2 : 1) }, 'Proposal linked')}><option value="">—</option>{proposals.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.title}</option>)}</select></Field>
              <Field label="Quotation link" hint="From the finance module (link only)."><div className="flex gap-2"><input className={inputCls} value={q || d.quotation_url} onChange={(e) => setQ(e.target.value)} placeholder="https://…" /><button type="button" className="btn-outline" onClick={() => patch({ quotation_url: q || d.quotation_url, step: Math.max(d.step, 3) }, 'Quotation shared — signing open')}>Save</button></div></Field>
              <Field label="Contract record"><select className={inputCls} value={d.contract_id ?? ''} onChange={(e) => patch({ contract_id: e.target.value || null }, 'Contract linked')}><option value="">—</option>{contracts.map((c) => <option key={c.id} value={c.id}>{c.number} · {c.title}</option>)}</select></Field>
              <Field label="Agreement text shown to the client"><textarea className={`${inputCls} h-32 py-2`} defaultValue={d.contract_terms} onBlur={(e) => e.target.value !== d.contract_terms && patch({ contract_terms: e.target.value }, 'Agreement updated')} disabled={!!d.signed_at} /></Field>
              {d.signed_at && !d.deposit_paid_at && <button type="button" className="btn-primary" onClick={() => patch({ deposit_paid_at: new Date().toISOString(), step: Math.max(d.step, 5) }, 'Deposit recorded')}>Deposit received ({d.deposit_pct}%)</button>}
              {d.deposit_paid_at && !d.kickoff_at && <div className="flex flex-col gap-2"><Field label="Kick-off call"><input type="datetime-local" className={inputCls} value={kick} onChange={(e) => setKick(e.target.value)} /></Field><button type="button" className="btn-primary" onClick={kickoff}>Book kick-off · mark lead Won</button></div>}
              {!d.signed_at && d.step >= 3 && <p className="m-0 text-amber-800">Waiting for the client to sign at the client link.</p>}
              <p className="m-0 text-xs text-basil-muted">Link expires {dmy(d.expires_on)} · token {d.token}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Phone: quick showcase links to send from the field. */
export function ShareQuick() {
  return (
    <div className="flex flex-col gap-4">
      <ShowcasesList compact />
      <h2 className="m-0 text-sm font-extrabold uppercase tracking-wide text-basil-muted">Deal rooms</h2>
      <DealsList compact />
    </div>
  );
}
