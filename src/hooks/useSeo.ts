import { useEffect } from 'react';

export function useSeo(title: string, description?: string) {
  useEffect(() => {
    document.title = title.includes('Basil Media') ? title : `${title} · Basil Media`;
    if (description) {
      let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!m) {
        m = document.createElement('meta');
        m.name = 'description';
        document.head.appendChild(m);
      }
      m.content = description;
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description);
    }
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', document.title);
  }, [title, description]);
}
