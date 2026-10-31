// Uploads go straight from the browser to storage so the server is never the bottleneck.
// Driver "supabase": Supabase Storage bucket. Driver "s3": any S3-compatible store
// (Cloudflare R2, Backblaze B2, MinIO) via a presigned URL from the `storage-presign` function.
import { supabase } from './supabase';

const driver = import.meta.env.VITE_STORAGE_DRIVER ?? 'supabase';
const bucket = import.meta.env.VITE_STORAGE_BUCKET ?? 'media';
const publicBase = import.meta.env.VITE_STORAGE_PUBLIC_URL ?? '';

const DEMO_MAX = 1.5 * 1024 * 1024;

function safeName(name: string) {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  const stem = name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'file';
  return `${stem}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${ext}`;
}

export async function uploadFile(file: File, folder: string, onProgress?: (pct: number) => void): Promise<string> {
  const path = `${folder}/${safeName(file.name)}`;
  if (!supabase) {
    if (file.size > DEMO_MAX) {
      throw new Error('Demo mode keeps uploads in this browser, so files must be under 1.5 MB. Connect Supabase/R2 for full-size photos and videos, or paste a link.');
    }
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
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
