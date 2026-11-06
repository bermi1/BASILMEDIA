// Public pages (no sign-in): a showcase at /s/:slug and a client deal room at /d/:token.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getDealRoom, getShowcase, logShareEvent, signDealRoom, type PublicDeal, type PublicShowcase } from './api';
import { DealRoomView, ShowcaseView } from './views';
import type { ReferenceItem } from './lib';

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F3F7FC] text-[#0A2F5C]">{children}</div>;
}
const Loading = () => <Frame><div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-[#0F6EC2]" size={32} /></div></Frame>;
const Missing = ({ what }: { what: string }) => (
  <Frame>
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <img src="/brand/basil-media-logo.svg" alt="Basil Media" className="h-20 w-auto" />
      <h1 className="m-0 text-2xl font-extrabold">This {what} is not available</h1>
      <p className="m-0 text-[#4A5D78]">The link may have expired. Ask your Basil Media contact for a new one.</p>
      <a href="/" className="font-bold">Visit basilmedia.co.tz →</a>
    </div>
  </Frame>
);

export function ShowcasePage() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<PublicShowcase | null | undefined>(undefined);
  const [reacted, setReacted] = useState<Record<string, string>>({});
  const viewed = useRef(false);
  useEffect(() => {
    getShowcase(slug).then((d) => {
      setData(d);
      document.title = d ? `${d.showcase.title} · Basil Media` : 'Basil Media';
      if (d && !viewed.current) {
        viewed.current = true;
        logShareEvent(d.showcase.id, 'view').catch(() => undefined);
      }
    }).catch(() => setData(null));
  }, [slug]);
  if (data === undefined) return <Loading />;
  if (!data) return <Missing what="showcase" />;
  const react = (it: ReferenceItem, kind: 'like' | 'need') => {
    if (reacted[it.id] === kind) return;
    setReacted((r) => ({ ...r, [it.id]: kind }));
    logShareEvent(data.showcase.id, kind, it.id).catch(() => undefined);
  };
  return (
    <Frame>
      <ShowcaseView showcase={data.showcase} items={data.items} reacted={reacted} onReact={react} onCta={() => logShareEvent(data.showcase.id, 'cta').catch(() => undefined)} />
    </Frame>
  );
}

export function DealRoomPage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicDeal | null | undefined>(undefined);
  const load = () => getDealRoom(token).then(setData).catch(() => setData(null));
  useEffect(() => {
    load();
    document.title = 'Deal room · Basil Media';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (data === undefined) return <Loading />;
  if (!data) return <Missing what="deal room" />;
  return (
    <Frame>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <DealRoomView deal={data.deal} proposal={data.proposal} contract={data.contract} showcaseSlug={data.showcase_slug} onSign={async (n) => { await signDealRoom(token, n); await load(); }} />
      </div>
    </Frame>
  );
}

export default ShowcasePage;
