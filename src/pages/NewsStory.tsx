import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { get } from '@/lib/db';
import { fmtDate, waLink } from '@/lib/format';
import type { NewsStory as Story } from '@/lib/types';
import { useSeo } from '@/hooks/useSeo';
import { Media } from '@/components/Media';

export default function NewsStory() {
  const { id = '' } = useParams();
  const [s, setS] = useState<Story | null | undefined>(undefined);
  useEffect(() => void get('news_stories', 'id', id).then((x) => setS(x && x.published ? x : null)).catch(() => setS(null)), [id]);
  useSeo(s?.title ?? 'Health News', s?.dek);
  if (s === undefined) return <div className="container-bm py-24 text-basil-muted">Loading…</div>;
  if (!s) return <div className="container-bm py-24"><h1>Story not found</h1><Link to="/health-news">Back to Health News</Link></div>;
  return (
    <>
      <article className="container-bm max-w-[820px] py-12">
        <Link to="/health-news" className="mb-6 inline-flex items-center gap-2 font-bold no-underline"><ArrowLeft size={18} /> Basil Brief</Link>
        <div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-basil-ice px-2.5 py-1 text-basil-deep">{s.tag}</span><span className="rounded-full bg-basil-mist px-2.5 py-1 text-basil-muted">{s.sector}</span></div>
        <h1 className="my-4 text-[clamp(32px,4.5vw,52px)] font-extrabold leading-[1.05]">{s.title}</h1>
        <p className="m-0 text-xl text-basil-muted">{s.dek}</p>
        <div className="my-6 flex items-center justify-between border-y border-basil-line py-3 text-sm text-basil-muted">
          <span>{fmtDate(s.published_at)} · {s.read_minutes} min read</span>
          <a href={waLink('', `${s.title} — ${location.href}`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold no-underline"><Share2 size={16} /> Share on WhatsApp</a>
        </div>
        {s.image_url && <Media src={s.image_url} overlay={false} className="mb-8 aspect-video rounded-3xl" />}
        <div className="whitespace-pre-line text-[17px] leading-[1.8] text-[#22344F]">{s.body}</div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-basil-mist p-5">
          <span><b className="block">Get the Basil Brief every Monday</b><span className="text-sm text-basil-muted">Health, youth opportunities, innovation, business and banking.</span></span>
          <Link to="/subscribe" className="btn-primary h-11 min-h-0">Subscribe free</Link>
        </div>
      </article>
    </>
  );
}
