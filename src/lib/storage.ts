// Uploads go straight from the browser to storage so the server is never the bottleneck.
// Driver "supabase": Supabase Storage bucket. Driver "s3": any S3-compatible store
// (Cloudflare R2, Backblaze B2, MinIO) via a presigned URL from the `storage-presign` function.
import { supabase } from './supabase';

const driver = import.meta.env.VITE_STORAGE_DRIVER ?? 'supabase';
const bucket = import.meta.env.VITE_STORAGE_BUCKET ?? 'media';
const publicBase = import.meta.env.VITE_STORAGE_PUBLIC_URL ?? '';

function safeName(name: string) {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  const stem = name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'file';
  return `${stem}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${ext}`;
}

/** Site pictures are resized (longest side 2000 px) and saved as WebP before upload, so a 6 MB phone photo
 *  becomes ~300 KB. Client photo galleries keep their full-size originals for download. */
export async function optimiseImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

export async function uploadFile(original: File, folder: string, onProgress?: (pct: number) => void): Promise<string> {
  const file = folder.startsWith('galleries') ? original : await optimiseImage(original);
  const path = `${folder}/${safeName(file.name)}`;
  if (driver === 's3') {
    const { data, error } = await supabase.functions.invoke('storage-presign', {
      body: { path, contentType: file.type || 'application/octet-stream' },
    });
    if (error) throw error;
    await putWithProgress(data.url as string, file, onProgress);
    return `${publicBase.replace(/\/$/, '')}/${path}`;
  }
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || undefined,
  });
  if (error) throw error;
  onProgress?.(100);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function putWithProgress(url: string, file: File, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

export const isVideoFile = (f: File) => f.type.startsWith('video/');
