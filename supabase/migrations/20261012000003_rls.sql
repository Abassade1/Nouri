-- =============================================================================
-- 0003  Row Level Security
--
-- Principles
--  * Deny by default: RLS is enabled on every table; no policy = no access.
--  * Owners see their own data. Carers see an owner's pet / address / medical
--    details only while they have an active booking with that owner.
--  * The public (signed-in) marketplace reads go through VIEWS that expose a
--    safe subset of columns and only for approved carers in active cities.
--  * Admins can read everything needed to review and resolve disputes.
--  * The service role (Edge Functions, Stripe webhooks) bypasses RLS.
-- =============================================================================

-- ---------- Visibility helpers ----------------------------------------------
create function public.owns_pet(p_pet uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pets where id = p_pet and owner_id = auth.uid())
$$;

-- p_full = false: carer has any live request/booking involving the pet (identity + routine).
-- p_full = true : carer has a confirmed / in-progress booking, or finished one within 7 days
--                 (health data, medications, care history).
create function public.carer_can_view_pet(p_pet uuid, p_full boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.booking_pets bp
      join public.bookings b on b.id = bp.booking_id
     where bp.pet_id = p_pet and b.carer_id = auth.uid()
       and case when p_full
             then b.status in ('confirmed', 'in_progress')
                  or (b.status = 'completed' and b.completed_at > now() - interval '7 days')
             else b.status in ('requested', 'accepted', 'confirmed', 'in_progress')
                  or (b.status = 'completed' and b.completed_at > now() - interval '7 days')
           end
  )
$$;

create function public.carer_can_view_owner(p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
     where b.carer_id = auth.uid() and b.owner_id = p_owner
       and (b.status in ('confirmed', 'in_progress')
            or (b.status = 'completed' and b.completed_at > now() - interval '7 days'))
  )
$$;

create function public.is_booking_counterparty(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
     where (b.owner_id = auth.uid() and b.carer_id = p_user)
        or (b.carer_id = auth.uid() and b.owner_id = p_user)
  )
$$;

create function public.can_see_booking(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b
                  where b.id = p_booking and (b.owner_id = auth.uid() or b.carer_id = auth.uid()))
      or public.is_admin()
$$;

-- Internal helper must not be callable from the API.
revoke execute on function public.log_booking_event(uuid, public.history_event_type, text, jsonb, uuid)
  from public, anon, authenticated;

-- ---------- Enable RLS everywhere -------------------------------------------
alter table public.languages            enable row level security;
alter table public.countries            enable row level security;
alter table public.cities               enable row level security;
alter table public.services             enable row level security;
alter table public.city_services        enable row level security;
alter table public.profiles             enable row level security;
alter table public.owner_profiles       enable row level security;
alter table public.carer_profiles       enable row level security;
alter table public.carer_references     enable row level security;
alter table public.credentials          enable row level security;
alter table public.carer_services       enable row level security;
alter table public.availability         enable row level security;
alter table public.pets                 enable row level security;
alter table public.pet_health           enable row level security;
alter table public.pet_medications      enable row level security;
alter table public.bookings             enable row level security;
alter table public.booking_pets         enable row level security;
alter table public.care_history_events  enable row level security;
alter table public.visit_reports        enable row level security;
alter table public.wellbeing_scores     enable row level security;
alter table public.concern_flags        enable row level security;
alter table public.concern_flag_actions enable row level security;
alter table public.reviews              enable row level security;
alter table public.payouts              enable row level security;
alter table public.waitlist             enable row level security;
alter table public.push_tokens          enable row level security;

-- ---------- Reference data: readable by everyone, writable by admins --------
create policy languages_read  on public.languages  for select to anon, authenticated using (is_enabled or public.is_admin());
create policy languages_admin on public.languages  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy countries_read  on public.countries  for select to anon, authenticated using (true);
create policy countries_admin on public.countries  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy cities_read     on public.cities     for select to anon, authenticated using (true);
create policy cities_admin    on public.cities     for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy services_read   on public.services  for select to anon, authenticated using (is_active or public.is_admin());
create policy services_admin  on public.services   for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy city_services_read  on public.city_services for select to anon, authenticated using (true);
create policy city_services_admin on public.city_services for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Profiles ---------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_booking_counterparty(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Owner profile ----------------------------------------------------
create policy owner_profiles_select on public.owner_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.carer_can_view_owner(user_id));
create policy owner_profiles_insert on public.owner_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.auth_role() = 'owner');
create policy owner_profiles_update on public.owner_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Carer profile & application -------------------------------------
create policy carer_profiles_select on public.carer_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy carer_profiles_insert on public.carer_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.auth_role() = 'carer');
create policy carer_profiles_update on public.carer_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy carer_profiles_admin_update on public.carer_profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy carer_references_own on public.carer_references for all to authenticated
  using (carer_id = auth.uid()) with check (carer_id = auth.uid());
create policy carer_references_admin on public.carer_references for select to authenticated
  using (public.is_admin());

create policy credentials_select on public.credentials for select to authenticated
  using (carer_id = auth.uid() or public.is_admin());
create policy credentials_insert on public.credentials for insert to authenticated
  with check (carer_id = auth.uid());
create policy credentials_update on public.credentials for update to authenticated
  using (carer_id = auth.uid() and status <> 'verified') with check (carer_id = auth.uid());
create policy credentials_delete on public.credentials for delete to authenticated
  using (carer_id = auth.uid() and status <> 'verified');
create policy credentials_admin_update on public.credentials for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Rates and availability: visible to signed-in users for approved carers.
create policy carer_services_select on public.carer_services for select to authenticated
  using (carer_id = auth.uid() or public.is_admin() or public.is_approved_carer(carer_id));
create policy carer_services_write on public.carer_services for all to authenticated
  using (carer_id = auth.uid()) with check (carer_id = auth.uid());

create policy availability_select on public.availability for select to authenticated
  using (carer_id = auth.uid() or public.is_admin() or public.is_approved_carer(carer_id));
create policy availability_write on public.availability for all to authenticated
  using (carer_id = auth.uid()) with check (carer_id = auth.uid());

-- ---------- Pets -------------------------------------------------------------
create policy pets_select on public.pets for select to authenticated
  using (owner_id = auth.uid() or public.is_admin() or public.carer_can_view_pet(id, false));
create policy pets_insert on public.pets for insert to authenticated
  with check (owner_id = auth.uid() and public.auth_role() = 'owner');
create policy pets_update on public.pets for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- No delete policy on purpose: pets are archived so care history is preserved.

create policy pet_health_select on public.pet_health for select to authenticated
  using (public.owns_pet(pet_id) or public.is_admin() or public.carer_can_view_pet(pet_id, true));
create policy pet_health_write on public.pet_health for all to authenticated
  using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));

create policy pet_medications_select on public.pet_medications for select to authenticated
  using (public.owns_pet(pet_id) or public.is_admin() or public.carer_can_view_pet(pet_id, true));
create policy pet_medications_write on public.pet_medications for all to authenticated
  using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));

-- ---------- Bookings ---------------------------------------------------------
create policy bookings_select on public.bookings for select to authenticated
  using (owner_id = auth.uid() or carer_id = auth.uid() or public.is_admin());
create policy bookings_insert on public.bookings for insert to authenticated
  with check (owner_id = auth.uid() and public.auth_role() = 'owner');
create policy bookings_update on public.bookings for update to authenticated
  using (owner_id = auth.uid() or carer_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or carer_id = auth.uid() or public.is_admin());

create policy booking_pets_select on public.booking_pets for select to authenticated
  using (public.can_see_booking(booking_id));
create policy booking_pets_insert on public.booking_pets for insert to authenticated
  with check (exists (select 1 from public.bookings b where b.id = booking_id and b.owner_id = auth.uid()));

-- ---------- Care records -----------------------------------------------------
create policy care_history_select on public.care_history_events for select to authenticated
  using (owner_id = auth.uid() or public.is_admin() or public.carer_can_view_pet(pet_id, true));
create policy care_history_insert on public.care_history_events for insert to authenticated
  with check (owner_id = auth.uid());

create policy visit_reports_select on public.visit_reports for select to authenticated
  using (public.can_see_booking(booking_id));
create policy visit_reports_insert on public.visit_reports for insert to authenticated
  with check (carer_id = auth.uid() and public.auth_role() = 'carer');

create policy wellbeing_select on public.wellbeing_scores for select to authenticated
  using (public.owns_pet(pet_id) or public.is_admin() or public.carer_can_view_pet(pet_id, true));
create policy wellbeing_insert on public.wellbeing_scores for insert to authenticated
  with check (public.auth_role() = 'carer');

create policy concern_flags_select on public.concern_flags for select to authenticated
  using (owner_id = auth.uid() or carer_id = auth.uid() or public.is_admin());
create policy concern_flags_insert on public.concern_flags for insert to authenticated
  with check (carer_id = auth.uid() and public.auth_role() = 'carer');

create policy flag_actions_select on public.concern_flag_actions for select to authenticated
  using (public.is_admin() or exists (select 1 from public.concern_flags f
          where f.id = flag_id and (f.owner_id = auth.uid() or f.carer_id = auth.uid())));
create policy flag_actions_insert on public.concern_flag_actions for insert to authenticated
  with check (actor_id = auth.uid());

-- ---------- Reviews, payouts, waitlist, push tokens -------------------------
create policy reviews_select on public.reviews for select to authenticated
  using (owner_id = auth.uid() or carer_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (owner_id = auth.uid() and public.auth_role() = 'owner');
create policy reviews_admin_delete on public.reviews for delete to authenticated
  using (public.is_admin());

create policy payouts_select on public.payouts for select to authenticated
  using (carer_id = auth.uid() or public.is_admin());

create policy waitlist_insert on public.waitlist for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy waitlist_admin_select on public.waitlist for select to authenticated
  using (public.is_admin());

create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Marketplace views (safe subset, approved carers only) -----------
-- Views run with their owner's rights, so they can read carer_profiles even
-- though signed-in users cannot read that table directly. That is intentional:
-- the column list below is the full set of things owners may see.
create view public.carer_directory as
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
  split_part(cp.postal_code, ' ', 1)  as postal_area,     -- e.g. "T3H" only
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
             where cs.carer_id = cp.user_id and cs.is_active), '[]'::jsonb) as services
from public.carer_profiles cp
join public.profiles p on p.id = cp.user_id
join public.cities ci on ci.id = cp.city_id and ci.is_active
where cp.status = 'approved';

create view public.carer_credential_badges as
select c.carer_id, c.type, c.title, c.issuer, c.expires_on, c.reviewed_at as verified_at
  from public.credentials c
  join public.carer_profiles cp on cp.user_id = c.carer_id and cp.status = 'approved'
 where c.status = 'verified'
   and (c.expires_on is null or c.expires_on >= current_date)
   and c.type not in ('id_document', 'other');

create view public.public_reviews as
select r.id, r.carer_id, r.rating, r.comment, r.created_at,
       split_part(coalesce(p.full_name, ''), ' ', 1) as reviewer_first_name
  from public.reviews r
  join public.profiles p on p.id = r.owner_id
  join public.carer_profiles cp on cp.user_id = r.carer_id and cp.status = 'approved';

-- Credentials that are close to expiring (used by the reminder job).
create view public.credentials_expiring_soon as
select c.id, c.carer_id, c.type, c.title, c.expires_on, c.expiry_reminded_at
  from public.credentials c
 where c.status = 'verified' and c.expires_on is not null
   and c.expires_on <= current_date + 30;

-- ---------- Table privileges -------------------------------------------------
-- Supabase grants broad default privileges; tighten the anonymous role to the
-- few things the signed-out app needs (city list for waitlist, services).
revoke all on all tables in schema public from anon;
grant select on public.languages, public.countries, public.cities,
                public.services, public.city_services to anon;
grant insert on public.waitlist to anon;

revoke all on public.carer_directory, public.carer_credential_badges,
              public.public_reviews, public.credentials_expiring_soon from anon, authenticated;
grant select on public.carer_directory, public.carer_credential_badges, public.public_reviews to authenticated;
-- credentials_expiring_soon: service role only.
