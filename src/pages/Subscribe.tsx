import { useSeo } from '@/hooks/useSeo';
import { SubscribeSection } from './HealthNews';

export default function Subscribe() {
  useSeo('Subscribe to the Basil Health Brief', 'Free weekly health news for Tanzanian doctors and health professionals, by SMS, WhatsApp or email.');
  return <SubscribeSection standalone source={new URLSearchParams(location.search).get('src') ?? 'subscribe-page'} />;
}
