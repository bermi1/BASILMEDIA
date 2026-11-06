// Basil Health Brief: health news and health events only — a short sign-up, upcoming events, live news.
import { useSeo } from '@/hooks/useSeo';
import { SubscribeSection } from './HealthNews';
import { UpcomingHealthEvents } from '@/components/UpcomingHealthEvents';
import { LiveHealthFeed } from '@/components/LiveHealthFeed';

export default function Subscribe() {
  useSeo('Subscribe to the Basil Health Brief', 'Free health news and health events for Tanzanian health workers, on WhatsApp or SMS.');
  return (
    <>
      <SubscribeSection standalone source={new URLSearchParams(location.search).get('src') ?? 'subscribe-page'} />
      <div className="container-bm flex flex-col gap-10 py-10 sm:py-14">
        <UpcomingHealthEvents />
        <LiveHealthFeed />
      </div>
    </>
  );
}
