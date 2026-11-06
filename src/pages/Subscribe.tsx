// Basil Brief sign-up: one short form, nothing else (the news itself lives on /health-news).
import { useSeo } from '@/hooks/useSeo';
import { SubscribeSection } from './HealthNews';

export default function Subscribe() {
  useSeo('Subscribe to the Basil Brief', 'Free news on health, youth opportunities, innovation, business and banking — on WhatsApp, SMS or email.');
  return <SubscribeSection standalone source={new URLSearchParams(location.search).get('src') ?? 'subscribe-page'} />;
}
