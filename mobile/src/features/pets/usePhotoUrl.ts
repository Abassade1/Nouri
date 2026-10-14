import { useEffect, useState } from 'react';

import { petsRepo } from './repo';

const cache = new Map<string, { url: string | null; at: number }>();
const TTL = 50 * 60 * 1000; // signed links last an hour

/** Resolves a private pet-photo path to a short-lived URL (cached). */
export function usePhotoUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? (cache.get(path)?.url ?? null) : null));
  useEffect(() => {
    if (!path) return setUrl(null);
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL) return setUrl(hit.url);
    let active = true;
    void petsRepo.photoUrl(path).then((u) => {
      cache.set(path, { url: u, at: Date.now() });
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}
