-- =============================================================================
-- 0013  Every kind of companion
--  * Pets can be horses, birds, rabbits, small mammals, reptiles and fish, not only dogs and cats.
--  * Carers say which animals they look after; the public listing shows it so owners can filter.
-- =============================================================================

alter type public.pet_species add value if not exists 'horse';
alter type public.pet_species add value if not exists 'bird';
alter type public.pet_species add value if not exists 'rabbit';
alter type public.pet_species add value if not exists 'small_mammal';
alter type public.pet_species add value if not exists 'reptile';
alter type public.pet_species add value if not exists 'fish';

-- Existing carers keep looking after dogs and cats until they say otherwise.
alter table public.carer_profiles
  add column species_served public.pet_species[] not null default '{dog,cat}'
  check (cardinality(species_served) between 1 and 12);

-- Public carer listing: add the animals each carer looks after.
create or replace view public.carer_directory as
select
  cp.user_id,
  cp.city_id,
  cp.display_name,
  cp.headline,
  cp.bio,
  cp.years_experience,
  cp.languages_spoken,
  cp.specialties,
  cp.service_radius_km,
  split_part(cp.postal_code, ' ', 1)  as postal_area,
  cp.rating_avg,
  cp.rating_count,
  p.avatar_path,
  coalesce((select array_agg(distinct c.type order by c.type)
              from public.credentials c
             where c.carer_id = cp.user_id and c.status = 'verified'
               and (c.expires_on is null or c.expires_on >= current_date)
               and c.type not in ('id_document', 'other')), '{}') as verified_badges,
  coalesce((select jsonb_agg(jsonb_build_object('service_id', cs.service_id, 'rate_cents', cs.rate_cents)
                             order by cs.rate_cents)
              from public.carer_services cs
              join public.services s on s.id = cs.service_id and s.is_active
             where cs.carer_id = cp.user_id and cs.is_active), '[]'::jsonb) as services,
  (select ph.path from public.carer_photos ph
    where ph.carer_id = cp.user_id
    order by ph.sort_order, ph.created_at
    limit 1) as cover_photo_path,
  cp.species_served
from public.carer_profiles cp
join public.profiles p on p.id = cp.user_id
join public.cities ci on ci.id = cp.city_id and ci.is_active
where cp.status = 'approved' and cp.payouts_enabled;
