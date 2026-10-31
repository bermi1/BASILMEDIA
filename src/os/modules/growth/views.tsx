// Client-facing views shared by the public pages (/s/:slug, /d/:token) and the OS previews.
import { useState } from 'react';
import { Calendar, Check, Heart, Mail, MessageCircle, Phone, Play, Sparkles } from 'lucide-react';
import { GoLink } from './kit';
import { DEAL_STEPS, dmy, type Contract, type Cta, type DealRoom, type Proposal, type ReferenceItem, type Showcase } from './lib';

const tsh = (n: number) => `TSH ${Math.round(n).toLocaleString('en-GB')}`;
const ctaIcon = (k: Cta['kind']) => (k === 'whatsapp' ? MessageCircle : k === 'call' ? Phone : k === 'email' ? Mail : k === 'book' ? Calendar : Sparkles);
const GRAD = ['from-[#0F6EC2] to-[#0A2F5C]', 'from-[#0F766E] to-[#0A2F5C]', 'from-[#B8860B] to-[#0A2F5C]', 'from-[#E8573F] to-[#0A2F5C]'];

function Thumb({ item, i }: { item: ReferenceItem; i: number }) {
  return item.thumbnail_url ? (
    <img src={item.thumbnail_url} alt="" className="aspect-video w-full rounded-xl object-cover" />
  ) : (
    <div className={`flex aspect-video w-full items-center justify-center rounded-xl bg-gradient-to-br ${GRAD[i % 4]} text-white`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20"><Play size={20} /></span>
    </div>
  );
}

export function ShowcaseView({ showcase: s, items, onReact, onCta, reacted = {} }: { showcase: Showcase; items: ReferenceItem[]; onReact?: (item: ReferenceItem, kind: 'like' | 'need') => void; onCta?: (c: Cta) => void; reacted?: Record<string, string> }) {
  const contact = s.contact;
  const ctas = (
    <div className="flex flex-col gap-2">
      {s.ctas.map((c, i) => {
        const I = ctaIcon(c.kind);
        return (
          <a key={i} href={c.url} target={c.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={() => onCta?.(c)} className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-4 font-bold no-underline ${i === 0 ? 'bg-[#0F6EC2] text-white' : 'border border-[#C9DDF2] bg-white text-[#0A2F5C]'}`}>
            <I size={18} />{c.label}
          </a>
        );
      })}
    </div>
  );
  const contactCard = (
    <div className="flex items-center gap-3 rounded-2xl border border-[#DCE8F5] bg-white p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EAF3FC] font-display font-extrabold text-[#0F6EC2]">{contact.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
      <span className="min-w-0 flex-1 text-sm"><b className="block text-base">{contact.name}</b>{contact.role} · Basil Media<br /><a href={`tel:${contact.phone}`}>{contact.phone}</a>{contact.email && <> · <a href={`mailto:${contact.email}`}>{contact.email}</a></>}</span>
    </div>
  );
  if (s.mode === 'linktree') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
        <img src="/brand/basil-media-logo.svg" alt="Basil Media" className="h-24 w-auto" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        <h1 className="m-0 font-display text-2xl font-extrabold text-[#0A2F5C]">{s.title}</h1>
        {s.welcome && <p className="m-0 text-[#4A5D78]">{s.welcome}</p>}
        <div className="flex w-full flex-col gap-2">
          {items.map((it) => (
            <a key={it.id} href={it.video_url || '#'} target="_blank" rel="noreferrer" onClick={() => onReact?.(it, 'like')} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-[#DCE8F5] bg-white px-4 text-left text-[#0A2F5C] no-underline shadow-sm">
              <Play size={18} className="shrink-0 text-[#0F6EC2]" /><span className="min-w-0 flex-1"><b className="block truncate">{it.title}</b><span className="text-xs text-[#4A5D78]">{it.kind} · {it.client_name}</span></span>
            </a>
          ))}
        </div>
        <div className="w-full">{ctas}</div>
        <div className="w-full text-left">{contactCard}</div>
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="rounded-[28px] bg-gradient-to-br from-[#0A2F5C] to-[#061E3D] p-6 text-white sm:p-10">
        <div className="font-mono text-[11px] tracking-[0.2em] text-[#9CC3EA]">BASIL MEDIA{s.recipient_name ? ` · PREPARED FOR ${s.recipient_name.toUpperCase()}` : ''}</div>
        <h1 className="m-0 mt-2 font-display text-3xl font-extrabold sm:text-4xl">{s.title}</h1>
        {s.welcome && <p className="m-0 mt-3 max-w-2xl text-[17px] leading-relaxed text-[#D7E6F6]">{s.welcome}</p>}
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <article key={it.id} className="flex flex-col gap-2 rounded-2xl border border-[#DCE8F5] bg-white p-3">
            {it.video_url ? <a href={it.video_url} target="_blank" rel="noreferrer"><Thumb item={it} i={i} /></a> : <Thumb item={it} i={i} />}
            <div className="text-xs font-bold uppercase tracking-wide text-[#0F6EC2]">{it.kind} · {it.sector} · {it.year}</div>
            <h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">{it.title}</h2>
            <p className="m-0 text-sm text-[#4A5D78]">{it.summary}</p>
            {it.results && <p className="m-0 text-sm font-bold text-emerald-700">{it.results}</p>}
            {onReact && (
              <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
                <button type="button" onClick={() => onReact(it, 'like')} aria-pressed={reacted[it.id] === 'like'} className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl text-sm font-bold ${reacted[it.id] === 'like' ? 'border-0 bg-[#E8573F] text-white' : 'border border-[#C9DDF2] bg-white text-[#0A2F5C]'}`}><Heart size={15} />I like this</button>
                <button type="button" onClick={() => onReact(it, 'need')} aria-pressed={reacted[it.id] === 'need'} className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl text-sm font-bold ${reacted[it.id] === 'need' ? 'border-0 bg-[#0F6EC2] text-white' : 'border border-[#C9DDF2] bg-white text-[#0A2F5C]'}`}><Sparkles size={15} />I need this</button>
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2"><h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">Talk to us</h2>{ctas}</div>
        <div className="flex flex-col gap-2"><h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">Your contact</h2>{contactCard}</div>
      </section>
      <footer className="text-center text-xs text-[#4A5D78]">Basil Media · Mikocheni, Dar es Salaam{s.expires_on ? ` · this page is available until ${dmy(s.expires_on)}` : ''}</footer>
    </div>
  );
}

/** Deal room as the client sees it: showcase → proposal → quotation → contract sign → deposit → kick-off. */
export function DealRoomView({ deal, proposal, contract, showcaseSlug, onSign, internal }: { deal: DealRoom; proposal: Proposal | null; contract: Contract | null; showcaseSlug: string | null; onSign?: (name: string) => Promise<void>; internal?: boolean }) {
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pct = Math.round((Math.min(deal.step, 6) / 6) * 100);
  const deposit = Math.round((deal.value * deal.deposit_pct) / 100);
  const sign = async () => {
    setErr('');
    if (!agree) return setErr('Tick the box to confirm you have read the agreement');
    setBusy(true);
    try {
      await onSign?.(name);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const box = 'rounded-2xl border border-[#DCE8F5] bg-white p-5';
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[24px] bg-gradient-to-br from-[#0A2F5C] to-[#061E3D] p-6 text-white">
        <div className="font-mono text-[11px] tracking-[0.2em] text-[#9CC3EA]">DEAL ROOM · {deal.client_name.toUpperCase()}</div>
        <h1 className="m-0 mt-1 font-display text-2xl font-extrabold">{deal.title}</h1>
        <div className="mt-1 text-[#D7E6F6]">Investment incl. VAT <b className="text-white">{tsh(deal.value)}</b></div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#5BB3F0]" style={{ width: `${pct}%` }} /></div>
        <div className="mt-1 text-sm text-[#D7E6F6]">{pct}% · {deal.step >= 6 ? 'Project kicked off' : `Next: ${DEAL_STEPS[deal.step]}`}</div>
        <ol className="m-0 mt-4 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-6">
          {DEAL_STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold ${i < deal.step ? 'bg-white/15 text-white' : i === deal.step ? 'bg-white text-[#0A2F5C]' : 'text-[#9CC3EA]'}`}>
              {i < deal.step ? <Check size={14} /> : <span className="w-3.5 text-center">{i + 1}</span>}{s}
            </li>
          ))}
        </ol>
      </div>
      <div className={box}>
        <h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">1 · Work we picked for you</h2>
        {showcaseSlug ? <a href={`/s/${showcaseSlug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center font-bold">Open your showcase →</a> : <p className="m-0 text-sm text-[#4A5D78]">Your account manager shared references in person.</p>}
      </div>
      {proposal && (
        <div className={box}>
          <h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">2 · What we propose <span className="text-sm font-normal text-[#4A5D78]">{proposal.number}</span></h2>
          <p className="m-0 mt-1 whitespace-pre-line text-sm">{proposal.what_we_propose}</p>
          {proposal.client_gains && <p className="m-0 mt-2 whitespace-pre-line text-sm">{proposal.client_gains}</p>}
          {internal && <GoLink to={`/os/growth/proposals/${proposal.id}`} className="mt-1 inline-flex min-h-[44px] items-center text-sm font-bold">Open full proposal →</GoLink>}
        </div>
      )}
      <div className={box}>
        <h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">3 · Quotation</h2>
        {deal.quotation_url ? <a href={deal.quotation_url} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center font-bold">Open quotation →</a> : <p className="m-0 text-sm text-[#4A5D78]">Your quotation link will appear here.</p>}
      </div>
      <div className={box}>
        <h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">4 · Production services agreement</h2>
        <p className="m-0 mt-1 text-sm text-[#4A5D78]">Between Basil Media, Dar es Salaam (“the Producer”) and {deal.client_name} (“the Client”).</p>
        <pre className="m-0 mt-2 whitespace-pre-wrap rounded-xl bg-[#F3F7FC] p-3 font-sans text-sm">{deal.contract_terms || contract?.title || 'Terms to follow.'}</pre>
        {deal.signed_at ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <b>Signed electronically by {deal.signed_name}</b><br />{new Date(deal.signed_at).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })} (EAT)<br /><span className="break-all text-xs">Device: {deal.signed_user_agent}</span>
          </div>
        ) : deal.step < 3 ? (
          <p className="m-0 mt-2 text-sm text-[#4A5D78]">Signing opens once the proposal and quotation are agreed.</p>
        ) : onSign ? (
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm font-bold">Full name of signatory<input className="h-12 rounded-xl border border-[#C9DDF2] px-3 text-[15px] font-normal" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            {name && <div className="rounded-xl border border-dashed border-[#C9DDF2] p-3 font-serif text-2xl italic text-[#0A2F5C]">{name}</div>}
            <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have read the agreement and sign it on behalf of {deal.client_name}.</label>
            {err && <p className="m-0 text-sm font-bold text-red-700" role="alert">{err}</p>}
            <button type="button" disabled={busy} onClick={sign} className="min-h-[52px] rounded-2xl border-0 bg-[#0F6EC2] font-bold text-white disabled:opacity-60">Sign agreement</button>
            <p className="m-0 text-xs text-[#4A5D78]">Your typed name, the time and your device are recorded as your electronic signature (Electronic Transactions Act).</p>
          </div>
        ) : <p className="m-0 mt-2 text-sm text-amber-800">Waiting for the client to sign.</p>}
      </div>
      <div className={box}>
        <h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">5 · Deposit · {deal.deposit_pct}% on signing</h2>
        <p className="m-0 mt-1 text-sm">{tsh(deposit)} {deal.deposit_paid_at ? <b className="text-emerald-700">· received {dmy(deal.deposit_paid_at)}</b> : '· pay by bank transfer or mobile money once signed; your account manager sends the invoice.'}</p>
      </div>
      <div className={box}>
        <h2 className="m-0 text-lg font-extrabold text-[#0A2F5C]">6 · Kick-off</h2>
        <p className="m-0 mt-1 text-sm">{deal.kickoff_at ? `Kick-off call booked for ${new Date(deal.kickoff_at).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}. Asante for choosing Basil Media.` : 'We book your kick-off call as soon as the deposit arrives.'}</p>
      </div>
    </div>
  );
}
