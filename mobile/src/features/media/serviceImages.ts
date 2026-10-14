import type { ImageSource } from 'expo-image';

import type { CarerListing, ServiceInfo } from '../marketplace/types';
import { publicUrl } from './repo';

/** Bundled photos (Pexels, see assets/images/photos/CREDITS.md). */
export const photos = {
  welcomeHero: require('../../../assets/images/photos/welcome-hero.jpg'),
  authBanner: require('../../../assets/images/photos/auth-banner.jpg'),
};

const bySlug: Record<string, number> = {
  dog_walking: require('../../../assets/images/photos/service-dog-walking.jpg'),
  drop_in: require('../../../assets/images/photos/service-drop-in.jpg'),
  overnight_sitting: require('../../../assets/images/photos/service-overnight-sitting.jpg'),
};

/**
 * Picture for a service: the cover an admin uploaded, else a bundled photo for the
 * built-in services, else the general brand photo.
 */
export function serviceImage(service: { slug: string; image_path?: string | null }): ImageSource | number {
  const uploaded = publicUrl('service-images', service.image_path);
  if (uploaded) return { uri: uploaded };
  return bySlug[service.slug] ?? photos.authBanner;
}

/** Cover for a carer's listing: their own first gallery photo, else a picture of the service shown. */
export function carerCover(carer: CarerListing, services: Map<string, ServiceInfo>, serviceId?: string | null): ImageSource | number | null {
  const own = publicUrl('carer-photos', carer.cover_photo_path);
  if (own) return { uri: own };
  const svc = services.get(serviceId ?? '') ?? services.get(carer.services[0]?.service_id ?? '');
  return svc ? serviceImage(svc) : null;
}
