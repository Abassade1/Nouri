import { PREVIEW_MODE } from '@/config/app';
import { supabase } from '@/lib/supabase';

import type { PickedImage } from '../pets/repo';

/** A photo in a carer's public gallery. `service_id` tags what it shows (e.g. a walk). */
export type CarerPhoto = {
  id: string;
  carer_id: string;
  path: string;
  service_id: string | null;
  caption: string | null;
  sort_order: number;
};

export const MAX_CARER_PHOTOS = 12;

/**
 * Public URL for a file in one of the public buckets. Local files (preview mode, or a
 * photo that hasn't uploaded yet) and absolute URLs pass straight through.
 */
export function publicUrl(bucket: 'avatars' | 'carer-photos' | 'service-images', path: string | null | undefined): string | null {
  if (!path) return null;
  if (!supabase || /^(file|https?|ph|content|blob|data):/.test(path)) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function db() {
  if (!supabase) throw new Error('not_configured');
  return supabase;
}

function extFor(mime: string) {
  return mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
}

async function upload(bucket: string, path: string, image: PickedImage) {
  const buffer = await (await fetch(image.uri)).arrayBuffer();
  const { error } = await db().storage.from(bucket).upload(path, buffer, { contentType: image.mimeType });
  if (error) throw error;
}

export interface MediaRepo {
  /** Uploads a new profile photo, points the profile at it and removes the old file. Returns the new path. */
  setAvatar(userId: string, image: PickedImage, previousPath: string | null): Promise<string>;
  listCarerPhotos(carerId: string): Promise<CarerPhoto[]>;
  addCarerPhoto(carerId: string, image: PickedImage, serviceId: string | null, caption: string | null): Promise<CarerPhoto>;
  updateCarerPhoto(photo: CarerPhoto, changes: { service_id?: string | null; caption?: string | null }): Promise<void>;
  removeCarerPhoto(photo: CarerPhoto): Promise<void>;
}

const supabaseRepo: MediaRepo = {
  async setAvatar(userId, image, previousPath) {
    // A fresh file name each time, so phones and CDNs never show a cached old photo.
    const path = `${userId}/avatar-${Date.now()}.${extFor(image.mimeType)}`;
    await upload('avatars', path, image);
    const { error } = await db().from('profiles').update({ avatar_path: path }).eq('id', userId);
    if (error) {
      await db().storage.from('avatars').remove([path]);
      throw error;
    }
    if (previousPath) await db().storage.from('avatars').remove([previousPath]);
    return path;
  },

  async listCarerPhotos(carerId) {
    const { data, error } = await db()
      .from('carer_photos')
      .select('id, carer_id, path, service_id, caption, sort_order')
      .eq('carer_id', carerId)
      .order('sort_order')
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as CarerPhoto[];
  },

  async addCarerPhoto(carerId, image, serviceId, caption) {
    const path = `${carerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFor(image.mimeType)}`;
    await upload('carer-photos', path, image);
    const { data, error } = await db()
      .from('carer_photos')
      .insert({ carer_id: carerId, path, service_id: serviceId, caption })
      .select('id, carer_id, path, service_id, caption, sort_order')
      .single();
    if (error) {
      await db().storage.from('carer-photos').remove([path]); // don't leave an orphan file
      throw error;
    }
    return data as CarerPhoto;
  },

  async updateCarerPhoto(photo, changes) {
    const { error } = await db().from('carer_photos').update(changes).eq('id', photo.id);
    if (error) throw error;
  },

  async removeCarerPhoto(photo) {
    const { error } = await db().from('carer_photos').delete().eq('id', photo.id);
    if (error) throw error;
    await db().storage.from('carer-photos').remove([photo.path]);
  },
};

// ---------------------------------------------------------------------------------------
// Preview: an in-memory gallery so the screens can be tried without a backend.
// ---------------------------------------------------------------------------------------
let previewPhotos: CarerPhoto[] = [];
let n = 0;

const previewRepo: MediaRepo = {
  async setAvatar(_userId, image) {
    return image.uri;
  },
  async listCarerPhotos(carerId) {
    return previewPhotos.filter((p) => p.carer_id === carerId);
  },
  async addCarerPhoto(carerId, image, serviceId, caption) {
    if (previewPhotos.filter((p) => p.carer_id === carerId).length >= MAX_CARER_PHOTOS) throw new Error('photo_limit_reached');
    const photo: CarerPhoto = { id: `ph-${++n}`, carer_id: carerId, path: image.uri, service_id: serviceId, caption, sort_order: 0 };
    previewPhotos = [...previewPhotos, photo];
    return photo;
  },
  async updateCarerPhoto(photo, changes) {
    previewPhotos = previewPhotos.map((p) => (p.id === photo.id ? { ...p, ...changes } : p));
  },
  async removeCarerPhoto(photo) {
    previewPhotos = previewPhotos.filter((p) => p.id !== photo.id);
  },
};

export const mediaRepo: MediaRepo = PREVIEW_MODE && !supabase ? previewRepo : supabaseRepo;
