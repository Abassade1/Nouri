import { useEffect, useState } from 'react';

import { PREVIEW_MODE } from '@/config/app';
import { previewCities } from '@/features/preview/data';
import { supabase } from '@/lib/supabase';
import type { City } from '@/types/db';

/** All configured cities (live first). Names come back as {en, fr, ar}; use localized() to display. */
export function useCities() {
  const [cities, setCities] = useState<City[]>(PREVIEW_MODE && !supabase ? previewCities : []);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase
      .from('cities')
      .select('id, slug, country_code, region_code, name_i18n, currency, default_language, tax_components, launch_areas, is_active')
      .order('is_active', { ascending: false })
      .order('slug')
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(true);
        else setCities((data as City[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { cities, loading, error };
}
