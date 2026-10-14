import type { City, Profile, UserRole } from '@/types/db';

/** Fake data for EXPO_PUBLIC_PREVIEW_MODE (design review without a backend). Mirrors supabase/seed.sql. */
export const previewProfile = (role: UserRole): Profile => ({
  id: `preview-${role}`,
  role,
  full_name: role === 'admin' ? 'Sam Rivera' : 'Alex Morgan',
  phone: null,
  avatar_path: null,
  preferred_language: 'en',
});

export const previewCities: City[] = [
  {
    id: 'c-calgary', slug: 'calgary', country_code: 'CA', region_code: 'AB',
    name_i18n: { en: 'Calgary', fr: 'Calgary', ar: 'كالغاري', zh: '卡尔加里' }, currency: 'CAD', default_language: 'en',
    tax_components: [{ code: 'GST', rate: 0.05 }],
    launch_areas: ['Aspen Woods', 'Springbank Hill', 'West Springs', 'Signal Hill', 'Discovery Ridge'],
    is_active: true,
  },
  {
    id: 'c-toronto', slug: 'toronto', country_code: 'CA', region_code: 'ON',
    name_i18n: { en: 'Toronto', fr: 'Toronto', ar: 'تورنتو', zh: '多伦多' }, currency: 'CAD', default_language: 'en',
    tax_components: [{ code: 'HST', rate: 0.13 }], launch_areas: [], is_active: false,
  },
  {
    id: 'c-montreal', slug: 'montreal', country_code: 'CA', region_code: 'QC',
    name_i18n: { en: 'Montréal', fr: 'Montréal', ar: 'مونتريال', zh: '蒙特利尔' }, currency: 'CAD', default_language: 'fr',
    tax_components: [{ code: 'GST', rate: 0.05 }, { code: 'QST', rate: 0.09975 }], launch_areas: [], is_active: false,
  },
  {
    id: 'c-dubai', slug: 'dubai', country_code: 'AE', region_code: 'Dubai',
    name_i18n: { en: 'Dubai', fr: 'Dubaï', ar: 'دبي', zh: '迪拜' }, currency: 'AED', default_language: 'ar',
    tax_components: [{ code: 'VAT', rate: 0.05 }], launch_areas: [], is_active: false,
  },
];
