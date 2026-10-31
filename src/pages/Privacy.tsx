import { Link } from 'react-router-dom';
import { useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';

export function Privacy() {
  const s = useSettings();
  useSeo('Privacy notice');
  return (
    <article className="container-bm max-w-[780px] py-14 leading-[1.75] text-[#22344F]">
      <div className="kicker">PRIVACY</div>
      <h1 className="mb-4 mt-2 text-4xl font-extrabold text-basil-ink">How Basil Media handles your data</h1>
      <p>Basil Media collects only what it needs to answer your enquiry, deliver your project or send the updates you asked for. We process personal data in line with the Tanzania Personal Data Protection Act, 2022.</p>
      <h2 className="text-2xl">What we collect</h2>
      <ul><li>Booking and contact forms: your name, phone or email and your message.</li><li>Basil Health Brief: your title, specialties, region, channel and language, plus a record of your consent.</li><li>Client galleries: which photos you favourite or download.</li></ul>
      <h2 className="text-2xl">Your rights</h2>
      <p>You may ask to see, correct or delete your data at any time, and you can stop messages instantly by replying STOP or using the unsubscribe link. Write to <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a> and we will act within 7 working days.</p>
      <h2 className="text-2xl">Who can see it</h2>
      <p>Only the Basil Media staff who need it for their work. We do not sell personal data.</p>
      <p className="text-sm text-basil-muted">See also: <Link to="/privacy/face-search">Face search and your data</Link>.</p>
    </article>
  );
}

export function FacePrivacy() {
  const s = useSettings();
  useSeo('Face search and your data');
  return (
    <article className="container-bm max-w-[780px] py-14 leading-[1.75] text-[#22344F]">
      <div className="kicker">FIND ME · PRIVACY &amp; ACCURACY</div>
      <h1 className="mb-4 mt-2 text-4xl font-extrabold text-basil-ink">Face search and your data</h1>
      <p>Find Me lets a guest find their own photos in one event gallery with a selfie. It is switched off by default and only turned on for a gallery when the organiser agrees.</p>
      <h2 className="text-2xl">How it works</h2>
      <ul>
        <li>Your selfie is turned into a list of numbers <b>on your own phone</b>. The image is never uploaded or stored.</li>
        <li>Only that list of numbers is compared with faces in the single gallery you opened — never with any other gallery or client.</li>
        <li>We record that you gave consent (time, gallery, policy version) without keeping your selfie.</li>
        <li>Face data is deleted automatically after the gallery expires.</li>
      </ul>
      <h2 className="text-2xl">Accuracy</h2>
      <p>Matching is not perfect. You can mark “This isn’t me” or browse the full gallery yourself.</p>
      <h2 className="text-2xl">Remove me</h2>
      <p>Anyone can ask for their face to be hidden or removed from a gallery. Email <a href={`mailto:${s.contact_email}?subject=Remove%20me%20from%20a%20gallery`}>{s.contact_email}</a> with the gallery name; the request is logged and actioned.</p>
      <p>Galleries of children or schools never use face search unless the organiser confirms they hold the legal consent.</p>
    </article>
  );
}

