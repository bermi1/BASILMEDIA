import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'sw';

const DICT = {
  services: ['Services', 'Huduma'],
  ourWork: ['Our Work', 'Kazi Zetu'],
  about: ['About Us', 'Kuhusu Sisi'],
  contact: ['Contact', 'Wasiliana'],
  findPhotos: ['Find my photos', 'Tafuta picha zangu'],
  book: ['Book a Session', 'Weka Miadi'],
  viewWork: ['View Our Work', 'Tazama Kazi Zetu'],
  chat: ['Chat with us', 'Ongea nasi'],
  whatsapp: ['WhatsApp us', 'Tuandikie WhatsApp'],
  ready: ['READY WHEN YOU ARE', 'TUKO TAYARI'],
  readyTitle: ["Let's create your next moment.", 'Tuunde tukio lako lijalo.'],
  explore: ['Explore', 'Gundua'],
  healthNews: ['Health News', 'Habari za Afya'],
  login: ['Staff & client login', 'Ingia (wafanyakazi na wateja)'],
  privacy: ['Privacy', 'Faragha'],
  faceData: ['Face search & your data', 'Utafutaji wa uso na data yako'],
  subscribe: ['Subscribe', 'Jiunge'],
  phoneOrEmail: ['Phone or email', 'Simu au barua pepe'],
  featured: ['FEATURED WORK', 'KAZI TEULE'],
  storiesMade: ['Stories we have made', 'Hadithi tulizotengeneza'],
  allProjects: ['All projects →', 'Miradi yote →'],
  highlights: ['HIGHLIGHTS', 'MATUKIO'],
  reelsTitle: ['Reels that play right here', 'Video fupi zinazocheza hapa hapa'],
  servicesTitle: ['Services built for story', 'Huduma zilizojengwa kwa hadithi'],
  partnersWords: ['Words from our partners', 'Maneno kutoka kwa washirika wetu'],
  bookTitle: ['Book a session', 'Weka miadi'],
  bookSub: ['We reply within one working day.', 'Tunajibu ndani ya siku moja ya kazi.'],
  name: ['Name', 'Jina'],
  service: ['Service', 'Huduma'],
  date: ['Date', 'Tarehe'],
  message: ['Message', 'Ujumbe'],
  send: ['Send →', 'Tuma →'],
  thanks: ['Thank you — request received.', 'Asante — ombi limepokelewa.'],
  thanksSub: ['Our team will call or WhatsApp you shortly.', 'Timu yetu itakupigia au kukuandikia WhatsApp hivi punde.'],
  all: ['All', 'Zote'],
  needLike: ['I need something like this', 'Nahitaji kitu kama hiki'],
  team: ['The team', 'Timu'],
  partnersWith: ['Partners we work with', 'Washirika tunaofanya nao kazi'],
  downloadProfile: ['Download company profile (PDF)', 'Pakua wasifu wa kampuni (PDF)'],
  sendMessage: ['Send us a message', 'Tutumie ujumbe'],
  sendMsgBtn: ['Send message', 'Tuma ujumbe'],
} as const;

export type DictKey = keyof typeof DICT;
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: DictKey) => string }>({
  lang: 'en',
  setLang: () => {},
  t: (k) => DICT[k][0],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('basil-lang') as Lang) || 'en';
    } catch {
      return 'en';
    }
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('basil-lang', lang);
    } catch {
      /* ignore */
    }
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t: (k) => DICT[k][lang === 'sw' ? 1 : 0] }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
