-- =============================================================================
-- 0001  Core: reference data (languages, countries, cities, services),
--       users/profiles, carer application data, credentials, rates, availability.
--
-- Conventions
--  * Anything a user can see that is "content we own" (service names, city
--    names, descriptions) is a jsonb map of language -> text, e.g.
--    {"en": "Dog walking", "fr": "Promenade de chien", "ar": "تمشية الكلاب"}.
--    The "en" key is required (English is the source language).
--  * Money is stored as integer minor units (cents) + an ISO currency code.
--  * Addresses are country-agnostic (line1, line2, locality, region,
--    postal_code, country_code). Postal codes are validated per country using
--    a regex stored on the countries table.
--  * Functions that must see more than the caller can see are SECURITY DEFINER
--    with an empty search_path (everything is schema-qualified).
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
create type public.user_role         as enum ('owner', 'carer', 'admin');
create type public.carer_status      as enum ('draft', 'pending', 'approved', 'rejected', 'suspended');
create type public.credential_type   as enum ('vet_tech', 'trainer_cert', 'groomer_cert', 'first_aid',
                                              'background_check', 'insurance', 'id_document', 'other');
create type public.credential_status as enum ('pending', 'verified', 'rejected');
create type public.rate_unit         as enum ('per_visit', 'per_walk', 'per_night', 'per_trip');

-- ---------- Generic helpers --------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Validates that a jsonb value is a language map that includes English.
create function public.is_i18n(v jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(v) = 'object' and v ? 'en' and length(coalesce(v->>'en', '')) > 0
$$;

-- ---------- Languages --------------------------------------------------------
-- Adding a language later = insert a row here + add translation files in the apps.
create table public.languages (
  code        text primary key check (code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  name        text not null,          -- endonym: "English", "Français", "العربية"
  is_rtl      boolean not null default false,
  is_enabled  boolean not null default true,
  sort_order  smallint not null default 0
);

-- ---------- Countries --------------------------------------------------------
create table public.countries (
  code                text primary key check (code ~ '^[A-Z]{2}$'),   -- ISO 3166-1 alpha-2
  name_i18n           jsonb not null check (public.is_i18n(name_i18n)),
  default_currency    char(3) not null check (default_currency ~ '^[A-Z]{3}$'),
  default_language    text not null references public.languages(code),
  phone_prefix        text not null,
  postal_code_regex   text,           -- null = no validation (country has no postal codes)
  postal_code_example text,
  region_label        text not null default 'Province',   -- UI hint only; localised in the apps
  is_active           boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------- Cities -----------------------------------------------------------
-- A city is configuration: currency, tax rules, commission, languages, services.
create table public.cities (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]+$'),
  country_code      text not null references public.countries(code),
  region_code       text not null,                     -- "AB", "ON", "Dubai"
  name_i18n         jsonb not null check (public.is_i18n(name_i18n)),
  timezone          text not null,
  currency          char(3) not null check (currency ~ '^[A-Z]{3}$'),
  default_language  text not null references public.languages(code),
  -- Tax rules, itemised so receipts can show each tax:
  --   [{"code":"GST","rate":0.05}, {"code":"PST","rate":0.07}]
  -- NOTE: rates are illustrative until your accountant confirms what applies.
  tax_components    jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(tax_components) = 'array'),
  commission_rate   numeric(5,4) not null default 0.15 check (commission_rate >= 0 and commission_rate < 1),
  launch_areas      text[] not null default '{}',     -- neighbourhoods we launch in (proper nouns)
  latitude          numeric(9,6),
  longitude         numeric(9,6),
  is_active         boolean not null default false,   -- "live": carers visible, bookings open
  launched_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger cities_updated before update on public.cities
  for each row execute function public.set_updated_at();

-- ---------- Services ---------------------------------------------------------
create table public.services (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name_i18n         jsonb not null check (public.is_i18n(name_i18n)),
  description_i18n  jsonb not null default '{"en":"-"}'::jsonb check (public.is_i18n(description_i18n)),
  rate_unit         public.rate_unit not null,
  icon              text,
  sort_order        smallint not null default 0,
  is_active         boolean not null default true
);

-- Which services each city offers ("set the service list").
create table public.city_services (
  city_id     uuid not null references public.cities(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  is_enabled  boolean not null default true,
  primary key (city_id, service_id)
);

-- ---------- Profiles (one per auth user) ------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                public.user_role,   -- null until chosen (social sign-ins pick a role in-app)
  full_name           text,
  phone               text,
  avatar_path         text,
  preferred_language  text not null default 'en' references public.languages(code),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- Security helpers (need profiles to exist) ------------------------
create function public.auth_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- "Privileged" = admin, OR the service role / SQL editor (no JWT => auth.uid() is null),
-- OR a trusted internal function that raised the bypass flag for this transaction.
-- Guard triggers use this to decide whether protected columns may change.
create function public.is_privileged() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is null
      or coalesce(current_setting('app.bypass_guard', true), '') = '1'
      or public.is_admin()
$$;

-- plpgsql (not sql) because carer_profiles is created further down.
create function public.is_approved_carer(p_carer uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (select 1 from public.carer_profiles where user_id = p_carer and status = 'approved');
end $$;

-- Canadian-style and generic postal code validation using the country's regex.
create function public.postal_code_ok(p_country text, p_postal text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_postal is null then true
    else coalesce(
      (select c.postal_code_regex is null or p_postal ~ c.postal_code_regex
         from public.countries c where c.code = p_country),
      false)
  end
$$;

-- ---------- Sign-up hook -----------------------------------------------------
-- Creates the profile row. Only 'owner' or 'carer' may be requested at sign-up;
-- 'admin' can never be self-assigned (set it by hand in the dashboard).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role;
  v_lang text;
begin
  if v_meta->>'role' in ('owner', 'carer') then
    v_role := (v_meta->>'role')::public.user_role;
  end if;

  select code into v_lang from public.languages
   where code = v_meta->>'preferred_language' and is_enabled;

  insert into public.profiles (id, role, full_name, preferred_language)
  values (new.id, v_role,
          nullif(trim(coalesce(v_meta->>'full_name', v_meta->>'name', '')), ''),
          coalesce(v_lang, 'en'));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role can't be changed by the user directly...
create function public.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_privileged() and new.role is distinct from old.role then
    raise exception 'role_change_not_allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- ...except once, via this function: pick owner or carer if none chosen yet.
create function public.choose_role(p_role public.user_role) returns void
language plpgsql security definer set search_path = '' as $$
declare v_rows int;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_role not in ('owner', 'carer') then raise exception 'invalid_role' using errcode = '42501'; end if;
  perform set_config('app.bypass_guard', '1', true);
  update public.profiles set role = p_role where id = auth.uid() and role is null;
  get diagnostics v_rows = row_count;          -- (PERFORM resets FOUND, so count rows explicitly)
  perform set_config('app.bypass_guard', '', true);
  if v_rows = 0 then raise exception 'role_already_set' using errcode = '42501'; end if;
end $$;

-- ---------- Owner profile ----------------------------------------------------
create table public.owner_profiles (
  user_id               uuid primary key references public.profiles(id) on delete cascade,
  city_id               uuid references public.cities(id),
  -- country-agnostic address
  address_line1         text,
  address_line2         text,
  locality              text,
  region                text,
  postal_code           text,
  country_code          text references public.countries(code),
  home_access_notes     text,            -- gate codes etc. Only shared with carers on an active booking.
  privacy_consent_at    timestamptz,     -- PIPEDA: explicit consent timestamp
  privacy_consent_ver   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint owner_postal_ok check (public.postal_code_ok(country_code, postal_code))
);
create trigger owner_profiles_updated before update on public.owner_profiles
  for each row execute function public.set_updated_at();

-- ---------- Carer profile ----------------------------------------------------
create table public.carer_profiles (
  user_id                     uuid primary key references public.profiles(id) on delete cascade,
  city_id                     uuid references public.cities(id),
  status                      public.carer_status not null default 'draft',
  display_name                text,
  headline                    text,
  bio                         text,
  years_experience            smallint check (years_experience between 0 and 60),
  languages_spoken            text[] not null default '{}',
  specialties                 text[] not null default '{}',  -- e.g. senior_care, medication, anxious_pets
  service_radius_km           smallint not null default 10 check (service_radius_km between 1 and 100),
  -- Approximate home base only (never shown to owners; only the first part of the postal code is)
  postal_code                 text,
  country_code                text references public.countries(code),
  latitude                    numeric(9,6),
  longitude                   numeric(9,6),
  -- consent & review trail
  background_check_consent_at timestamptz,
  background_check_consent_ver text,
  terms_accepted_at           timestamptz,
  submitted_at                timestamptz,
  reviewed_at                 timestamptz,
  reviewed_by                 uuid references public.profiles(id),
  rejection_reason            text,
  -- payments (Phase 5)
  stripe_account_id           text,
  payouts_enabled             boolean not null default false,
  -- denormalised rating, maintained by trigger
  rating_avg                  numeric(3,2) not null default 0,
  rating_count                integer not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint carer_postal_ok check (public.postal_code_ok(country_code, postal_code))
);
create index carer_profiles_city_status on public.carer_profiles (city_id, status);
create trigger carer_profiles_updated before update on public.carer_profiles
  for each row execute function public.set_updated_at();

create table public.carer_references (
  id            uuid primary key default gen_random_uuid(),
  carer_id      uuid not null references public.carer_profiles(user_id) on delete cascade,
  name          text not null,
  relationship  text,
  email         text,
  phone         text,
  created_at    timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index carer_references_carer on public.carer_references (carer_id);

-- ---------- Credentials ------------------------------------------------------
-- Badges are issued ONLY by an admin flipping status to 'verified'.
create table public.credentials (
  id             uuid primary key default gen_random_uuid(),
  carer_id       uuid not null references public.carer_profiles(user_id) on delete cascade,
  type           public.credential_type not null,
  title          text not null,
  issuer         text,
  file_path      text not null,                    -- path in the private 'credentials' bucket
  issued_on      date,
  expires_on     date,
  status         public.credential_status not null default 'pending',
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  review_notes   text,
  expiry_reminded_at timestamptz,                  -- set by the reminder job
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);
create index credentials_carer on public.credentials (carer_id);
create index credentials_expiry on public.credentials (expires_on) where status = 'verified';
create trigger credentials_updated before update on public.credentials
  for each row execute function public.set_updated_at();

-- ---------- Rates & availability --------------------------------------------
create table public.carer_services (
  carer_id    uuid not null references public.carer_profiles(user_id) on delete cascade,
  service_id  uuid not null references public.services(id),
  rate_cents  integer not null check (rate_cents between 100 and 1000000),
  is_active   boolean not null default true,
  primary key (carer_id, service_id)
);

create table public.availability (
  id          uuid primary key default gen_random_uuid(),
  carer_id    uuid not null references public.carer_profiles(user_id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);
create index availability_carer on public.availability (carer_id, weekday);

-- ---------- Guards -----------------------------------------------------------
-- Carer profile: owners of the row may edit content, but never the review
-- result, rating or payment fields. They may only move draft/rejected -> pending
-- ("submit"), and only when the application is complete.
create function public.guard_carer_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_creds int;
  v_refs  int;
begin
  if tg_op = 'INSERT' then
    if not public.is_privileged() then
      new.user_id := auth.uid();
      new.status := 'draft';
      new.rating_avg := 0; new.rating_count := 0;
      new.stripe_account_id := null; new.payouts_enabled := false;
      new.reviewed_at := null; new.reviewed_by := null; new.rejection_reason := null;
    end if;
    return new;
  end if;

  if public.is_privileged() then
    if new.status is distinct from old.status and public.is_admin() then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;
    return new;
  end if;

  -- carer editing their own row
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  new.stripe_account_id := old.stripe_account_id;
  new.payouts_enabled := old.payouts_enabled;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  new.rejection_reason := old.rejection_reason;
  new.submitted_at := old.submitted_at;

  if new.status is distinct from old.status then
    if not (old.status in ('draft', 'rejected') and new.status = 'pending') then
      raise exception 'status_change_not_allowed' using errcode = '42501';
    end if;
    select count(*) into v_creds from public.credentials where carer_id = new.user_id;
    select count(*) into v_refs  from public.carer_references where carer_id = new.user_id;
    if new.city_id is null or coalesce(new.display_name, '') = '' or coalesce(new.bio, '') = '' then
      raise exception 'application_incomplete_profile';
    end if;
    if new.background_check_consent_at is null or new.terms_accepted_at is null then
      raise exception 'application_missing_consent';
    end if;
    if v_creds < 1 then raise exception 'application_needs_credential'; end if;
    if v_refs < 2 then raise exception 'application_needs_two_references'; end if;   -- policy: change here
    new.submitted_at := now();
  end if;
  return new;
end $$;
create trigger carer_profiles_guard before insert or update on public.carer_profiles
  for each row execute function public.guard_carer_profile();

-- Credentials: users can't mark their own documents verified, and changing the
-- document or dates resets verification.
create function public.guard_credential() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_privileged() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status and public.is_admin() then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.reviewed_by := null; new.reviewed_at := null; new.review_notes := null;
  else
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.review_notes := old.review_notes;
    new.expiry_reminded_at := old.expiry_reminded_at;
    new.carer_id := old.carer_id;
    new.status := 'pending';        -- any carer edit sends it back for review
  end if;
  return new;
end $$;
create trigger credentials_guard before insert or update on public.credentials
  for each row execute function public.guard_credential();

-- Rates: a carer can only offer services their city has switched on.
create function public.guard_carer_service() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
      from public.carer_profiles cp
      join public.city_services cs on cs.city_id = cp.city_id and cs.service_id = new.service_id and cs.is_enabled
      join public.services s on s.id = new.service_id and s.is_active
     where cp.user_id = new.carer_id
  ) then
    raise exception 'service_not_available_in_city';
  end if;
  return new;
end $$;
create trigger carer_services_guard before insert or update on public.carer_services
  for each row execute function public.guard_carer_service();
