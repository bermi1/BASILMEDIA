// Bermi AI face search. Everything that touches a face image runs in the browser: the model is
// loaded at runtime from a pinned CDN build (no npm dependency), photos are indexed in the staff
// member's browser and a visitor's selfie becomes a 1024-number fingerprint on their own phone.
// The selfie image is never uploaded or stored; only the fingerprint is sent to face_search().
import { supabase } from './supabase';
import { list } from './db';
import type { Gallery, MediaItem } from './types';

const HUMAN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.esm.js';
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/';
export const EMBEDDING_DIM = 1024; // faceres descriptor length; must match vector(1024) in 0013
export const MATCH_THRESHOLD = 0.5; // cosine similarity; calibrate on real event photos
export const HIGH_CONFIDENCE = 0.65;
export const CLUSTER_THRESHOLD = 0.6;
export const POLICY_VERSION = 'face-search-2026-10';

// ---------- model ----------
type Angle = { roll: number; yaw: number; pitch: number };
type HumanFace = {
  box: [number, number, number, number];
  boxRaw?: [number, number, number, number];
  score: number;
  faceScore?: number;
  embedding?: number[];
  rotation?: { angle: Angle } | null;
};
type HumanResult = { face: HumanFace[]; gesture?: { face?: number; gesture: string }[] };
type Human = { load(): Promise<void>; warmup(): Promise<unknown>; detect(input: unknown): Promise<HumanResult> };

let model: Promise<Human> | null = null;
/** Loads the face model once per page; later calls reuse it. */
export function loadModel(): Promise<Human> {
  model ??= (async () => {
    const mod = (await import(/* @vite-ignore */ HUMAN_URL)) as { Human: new (cfg: unknown) => Human };
    const human = new mod.Human({
      modelBasePath: MODELS_URL,
      cacheSensitivity: 0, // every photo/frame is processed fresh
      debug: false,
      face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 40, minConfidence: 0.5, return: false },
        mesh: { enabled: true },
        iris: { enabled: true },
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
      gesture: { enabled: true },
    });
    await human.load();
    await human.warmup();
    return human;
  })();
  model.catch(() => (model = null)); // allow a retry after a network failure
  return model;
}

// ---------- detection ----------
/** Normalised face box (0–1 of the photo) plus the photo's aspect ratio, for crops. */
export type FaceBox = { x: number; y: number; w: number; h: number; ar: number };
export type DetectedFace = { box: FaceBox; embedding: number[]; score: number };

const dims = (el: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) =>
  el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : [el.width, el.height];

function toBox(f: HumanFace, W: number, H: number): FaceBox {
  const [x, y, w, h] = f.boxRaw ?? [f.box[0] / W, f.box[1] / H, f.box[2] / W, f.box[3] / H];
  return { x, y, w, h, ar: W / H || 1 };
}

export async function detectFaces(img: HTMLImageElement | HTMLCanvasElement): Promise<DetectedFace[]> {
  const human = await loadModel();
  const [W, H] = dims(img);
  const res = await human.detect(img);
  return res.face
    .filter((f) => f.embedding && f.embedding.length === EMBEDDING_DIM)
    .map((f) => ({ box: toBox(f, W, H), embedding: Array.from(f.embedding!, (v) => Math.round(v * 1e5) / 1e5), score: f.faceScore ?? f.score }));
}

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export class LivenessError extends Error {}

/**
 * Watches the camera for up to 6 s. Passes on a blink or a head turn (yaw from the face mesh);
 * if the model gives no rotation it falls back to a visible head movement between frames.
 * Returns the best (sharpest, most frontal) embedding from the session.
 */
export async function embedSelfie(video: HTMLVideoElement, onStatus?: (s: string) => void, signal?: AbortSignal): Promise<{ embedding: number[]; method: string }> {
  const human = await loadModel();
  const start = performance.now();
  let best: { e: number[]; q: number } | null = null;
  let yawMin = Infinity, yawMax = -Infinity, cxMin = Infinity, cxMax = -Infinity;
  let blink = false, rotation = false;
  onStatus?.('Blink, or turn your head slowly left and right');
  while (performance.now() - start < 6000) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const res = await human.detect(video);
    const [W, H] = dims(video);
    const f = [...res.face].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
    if (f?.embedding?.length === EMBEDDING_DIM) {
      const yaw = f.rotation?.angle?.yaw;
      if (typeof yaw === 'number' && Number.isFinite(yaw)) { rotation = true; yawMin = Math.min(yawMin, yaw); yawMax = Math.max(yawMax, yaw); }
      const b = toBox(f, W, H);
      const cx = b.x + b.w / 2;
      cxMin = Math.min(cxMin, cx); cxMax = Math.max(cxMax, cx);
      if (res.gesture?.some((g) => (g.face ?? 0) === 0 && g.gesture.startsWith('blink'))) blink = true;
      const q = (f.faceScore ?? f.score) * (1 - Math.min(0.8, Math.abs(yaw ?? 0)));
      if (!best || q > best.q) best = { e: Array.from(f.embedding), q };
      const turned = rotation && yawMax - yawMin > 0.25;
      const moved = !rotation && cxMax - cxMin > 0.08;
      if (best && best.q > 0.3 && (blink || turned || moved)) {
        return { embedding: best.e, method: blink ? 'blink' : turned ? 'head-turn' : 'movement' };
      }
      onStatus?.(rotation ? 'Good — now blink, or turn your head a little' : 'Good — now move your head a little');
    } else {
      onStatus?.('Fit your face in the oval, in good light');
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new LivenessError(best ? 'We could not confirm a live face. Blink or turn your head and try again.' : 'No face was found. Try better light.');
}

// ---------- demo store (no Supabase) ----------
export type FaceRow = { id: string; media_id: string; gallery_id: string; box: FaceBox; embedding: number[]; quality: number };
export type Cluster = { id: string; gallery_id: string; member_ids: string[]; size: number; cover: { media_id: string; box: FaceBox }; label?: string };
type FaceDemo = {
  faces: FaceRow[]; indexed: { media_id: string; gallery_id: string }[]; clusters: Cluster[];
  log: { gallery_id: string; fingerprint: string; at: number }[]; consents: unknown[]; removals: unknown[];
};
const DKEY = 'basil-demo-face-v1';
let demo: FaceDemo | null = null;
function demoDb(): FaceDemo {
  if (demo) return demo;
  try { demo = JSON.parse(localStorage.getItem(DKEY) ?? 'null'); } catch { /* ignore */ }
  return (demo ??= { faces: [], indexed: [], clusters: [], log: [], consents: [], removals: [] });
}
function saveDemo() {
  try { localStorage.setItem(DKEY, JSON.stringify(demoDb())); } catch { throw new Error('Browser storage is full — demo mode can only index a small gallery.'); }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const vec = (e: number[]) => `[${e.join(',')}]`;
const parseVec = (v: unknown): number[] => (typeof v === 'string' ? JSON.parse(v) : (v as number[]));

// ---------- indexing (staff) ----------
function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load photo'));
    img.src = url;
  });
}

async function indexedIds(galleryId: string): Promise<Set<string>> {
  if (!supabase) return new Set(demoDb().indexed.filter((x) => x.gallery_id === galleryId).map((x) => x.media_id));
  const { data, error } = await supabase.from('face_indexed_media').select('media_id').eq('gallery_id', galleryId);
  if (error) throw error;
  return new Set((data ?? []).map((x) => x.media_id as string));
}

export type IndexProgress = { done: number; total: number; faces: number; skipped: number; failed: number };

/** Indexes every not-yet-indexed photo of a gallery in this browser. */
export async function indexGallery(g: Gallery, media: MediaItem[], onProgress: (p: IndexProgress) => void, signal?: AbortSignal) {
  if (!g.face_search_enabled) throw new Error('Turn on Find Me (face search) for this gallery first.');
  await loadModel();
  const seen = await indexedIds(g.id);
  const photos = media.filter((m) => m.kind === 'photo' && m.url);
  const todo = photos.filter((m) => !seen.has(m.id));
  const p: IndexProgress = { done: 0, total: todo.length, faces: 0, skipped: photos.length - todo.length, failed: 0 };
  onProgress({ ...p });
  for (const m of todo) {
    if (signal?.aborted) break;
    try {
      const faces = await detectFaces(await loadImage(m.url));
      const rows = faces.map((f) => ({ media_id: m.id, gallery_id: g.id, box: f.box, embedding: f.embedding, quality: Math.round(f.score * 1000) / 1000 }));
      if (supabase) {
        if (rows.length) {
          const { error } = await supabase.from('face_embeddings').insert(rows.map((r) => ({ ...r, embedding: vec(r.embedding) })));
          if (error) throw error;
        }
        const { error } = await supabase.from('face_indexed_media').insert({ media_id: m.id, gallery_id: g.id, face_count: rows.length });
        if (error) throw error;
      } else {
        const db = demoDb();
        db.faces.push(...rows.map((r) => ({ ...r, id: uid() })));
        db.indexed.push({ media_id: m.id, gallery_id: g.id });
        saveDemo();
      }
      p.faces += rows.length;
    } catch {
      p.failed++;
    }
    p.done++;
    onProgress({ ...p });
  }
  return p;
}

export async function listFaces(galleryId: string): Promise<FaceRow[]> {
  if (!supabase) return demoDb().faces.filter((f) => f.gallery_id === galleryId);
  const { data, error } = await supabase.from('face_embeddings').select('id, media_id, gallery_id, box, embedding, quality').eq('gallery_id', galleryId).limit(5000);
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, embedding: parseVec(r.embedding) }) as FaceRow);
}

// ---------- people (staff, internal only) ----------
/** Greedy cosine clustering: each face joins the first cluster whose centroid is close enough. */
export function clusterFaces(faces: FaceRow[], threshold = CLUSTER_THRESHOLD) {
  const groups: { centroid: number[]; members: FaceRow[] }[] = [];
  for (const f of [...faces].sort((a, b) => b.quality - a.quality)) {
    let target = null as (typeof groups)[number] | null, bestSim = threshold;
    for (const c of groups) { const s = cosine(f.embedding, c.centroid); if (s >= bestSim) { bestSim = s; target = c; } }
    if (!target) groups.push({ centroid: [...f.embedding], members: [f] });
    else {
      const n = target.members.push(f);
      target.centroid = target.centroid.map((v, i) => v + (f.embedding[i] - v) / n);
    }
  }
  return groups.sort((a, b) => b.members.length - a.members.length);
}

export async function loadClusters(galleryId: string): Promise<Cluster[]> {
  if (!supabase) return demoDb().clusters.filter((c) => c.gallery_id === galleryId);
  const { data, error } = await supabase.from('face_clusters').select('id, gallery_id, member_ids, size, cover, face_cluster_labels(label)').eq('gallery_id', galleryId).order('size', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, label: (c.face_cluster_labels as { label: string }[] | null)?.[0]?.label ?? '' }) as Cluster);
}

/** Re-clusters a gallery, replacing its clusters and carrying labels over by member overlap. */
export async function rebuildClusters(galleryId: string): Promise<Cluster[]> {
  const [faces, old] = await Promise.all([listFaces(galleryId), loadClusters(galleryId)]);
  const next: Cluster[] = clusterFaces(faces).map((c) => {
    const ids = c.members.map((m) => m.id);
    const prev = old.filter((o) => o.label).map((o) => ({ o, n: o.member_ids.filter((x) => ids.includes(x)).length })).sort((a, b) => b.n - a.n)[0];
    return { id: uid(), gallery_id: galleryId, member_ids: ids, size: ids.length, cover: { media_id: c.members[0].media_id, box: c.members[0].box }, label: prev?.n ? prev.o.label : '' };
  });
  if (!supabase) {
    const db = demoDb();
    db.clusters = [...db.clusters.filter((c) => c.gallery_id !== galleryId), ...next];
    saveDemo();
    return next;
  }
  let { error } = await supabase.from('face_clusters').delete().eq('gallery_id', galleryId);
  if (error) throw error;
  if (next.length) {
    ({ error } = await supabase.from('face_clusters').insert(next.map(({ label: _l, ...c }) => c)));
    if (error) throw error;
    const labels = next.filter((c) => c.label).map((c) => ({ cluster_id: c.id, label: c.label }));
    if (labels.length) ({ error } = await supabase.from('face_cluster_labels').insert(labels));
    if (error) throw error;
  }
  return next;
}

export async function labelCluster(clusterId: string, label: string) {
  if (!supabase) {
    const c = demoDb().clusters.find((x) => x.id === clusterId);
    if (c) c.label = label;
    return saveDemo();
  }
  const { error } = await supabase.from('face_cluster_labels').upsert({ cluster_id: clusterId, label: label.trim() }, { onConflict: 'cluster_id' });
  if (error) throw error;
}

// ---------- search (visitor) ----------
/** A one-way hash of a few browser traits, used only to rate-limit searches. */
export async function clientFingerprint(slug: string) {
  const raw = [navigator.userAgent, navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone, screen.width, screen.height, navigator.hardwareConcurrency, slug].join('|');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function recordConsent(g: Gallery) {
  const row = { gallery_id: g.id, policy_version: POLICY_VERSION, user_agent: navigator.userAgent.slice(0, 300) };
  if (!supabase) { demoDb().consents.push({ ...row, created_at: new Date().toISOString() }); return saveDemo(); }
  const { error } = await supabase.from('face_search_consents').insert(row);
  if (error) throw error;
}

export type Match = MediaItem & { similarity: number; confidence: 'High' | 'Possible' };
const conf = (s: number): Match['confidence'] => (s >= HIGH_CONFIDENCE ? 'High' : 'Possible');

/** Searches ONE gallery for the selfie fingerprint. Only the numbers leave the device. */
export async function searchGallery(g: Gallery, embedding: number[]): Promise<Match[]> {
  const fingerprint = await clientFingerprint(g.slug);
  if (supabase) {
    const { data, error } = await supabase.rpc('face_search', { p_slug: g.slug, p_embedding: vec(embedding), p_threshold: MATCH_THRESHOLD, p_fingerprint: fingerprint });
    if (error) throw error;
    return ((data ?? []) as (MediaItem & { similarity: number })[]).map((m) => ({ ...m, confidence: conf(m.similarity) }));
  }
  const db = demoDb();
  const hourAgo = Date.now() - 3600e3;
  db.log = db.log.filter((l) => l.at > hourAgo);
  if (db.log.filter((l) => l.gallery_id === g.id && l.fingerprint === fingerprint).length >= 20) throw new Error('Too many searches. Please try again in an hour.');
  db.log.push({ gallery_id: g.id, fingerprint, at: Date.now() });
  saveDemo();
  const best = new Map<string, number>();
  for (const f of db.faces) {
    if (f.gallery_id !== g.id) continue;
    const s = cosine(embedding, f.embedding);
    if (s >= MATCH_THRESHOLD && s > (best.get(f.media_id) ?? 0)) best.set(f.media_id, s);
  }
  const media = await list('media_items', { eq: { gallery_id: g.id } });
  return media.filter((m) => best.has(m.id)).map((m) => ({ ...m, similarity: best.get(m.id)!, confidence: conf(best.get(m.id)!) })).sort((a, b) => b.similarity - a.similarity);
}

export async function requestRemoval(r: { gallery_id: string | null; gallery_slug: string; name: string; contact: string; reason: string }) {
  if (!supabase) { demoDb().removals.push({ ...r, status: 'new', created_at: new Date().toISOString() }); return saveDemo(); }
  const { error } = await supabase.from('face_removal_requests').insert({ ...r, status: 'new' });
  if (error) throw error;
}
