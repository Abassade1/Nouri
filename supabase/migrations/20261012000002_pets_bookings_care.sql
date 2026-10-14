-- =============================================================================
-- 0002  Pets, bookings, visit reports, wellbeing, concern flags, care history,
--       reviews, payouts, waitlist, push tokens.
--
-- Trust layer: visit_reports, wellbeing_scores, concern_flags,
-- concern_flag_actions and care_history_events are APPEND-ONLY. Rows can be
-- inserted but never updated or deleted (enforced by trigger, so it holds even
-- for admins and the service role). The only exception is the cascade that
-- runs when a user deletes their account (privacy right to erasure).
-- =============================================================================

create type public.pet_species      as enum ('dog', 'cat', 'other');
create type public.pet_sex          as enum ('male', 'female', 'unknown');
create type public.pet_tag          as enum ('healthy', 'senior', 'special_needs', 'on_medication');
create type public.insurance_status as enum ('unknown', 'none', 'insured');
create type public.booking_status   as enum ('requested', 'accepted', 'declined', 'payment_failed',
                                             'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed');
create type public.wellbeing_metric as enum ('health', 'nutrition_hydration', 'activity', 'happiness');
create type public.concern_category as enum ('health', 'behaviour', 'other');
create type public.concern_severity as enum ('info', 'concern', 'urgent');
create type public.flag_action_type as enum ('acknowledged', 'called_vet', 'booked_pet_taxi', 'resolved', 'note');
create type public.history_event_type as enum ('visit_report', 'medication_given', 'vet_visit',
                                               'concern_flag', 'flag_action', 'booking_completed', 'note');
create type public.payout_status    as enum ('pending', 'in_transit', 'paid', 'failed');

-- ---------- Append-only enforcement -----------------------------------------
create function public.prevent_modification() returns trigger
language plpgsql as $$
begin
  -- Allow only what a cascading delete does when someone erases their account
  -- (foreign-key actions run at trigger depth > 1): deleting the rows, or
  -- nulling a reference to a deleted parent. No content can change.
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    if tg_op = 'UPDATE'
       and (to_jsonb(new) - 'booking_id' - 'actor_id' - 'taxi_booking_id')
         = (to_jsonb(old) - 'booking_id' - 'actor_id' - 'taxi_booking_id') then
      return new;
    end if;
  end if;
  raise exception 'append_only: % on % is not allowed', tg_op, tg_table_name using errcode = '42501';
end $$;

-- ---------- Pets -------------------------------------------------------------
-- pets        = identity + routine (carers see this once they have a request)
-- pet_health  = sensitive health data (carers see this only for active bookings)
create table public.pets (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  species           public.pet_species not null,
  breed             text,
  sex               public.pet_sex not null default 'unknown',
  is_neutered       boolean,
  birth_date        date check (birth_date <= current_date),
  weight_kg         numeric(5,2) check (weight_kg > 0 and weight_kg < 200),
  photo_path        text,
  tags              public.pet_tag[] not null default '{}',
  behaviour_notes   text,
  feeding_routine   text,
  walking_routine   text,
  quirks            text,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index pets_owner on public.pets (owner_id) where archived_at is null;
create trigger pets_updated before update on public.pets
  for each row execute function public.set_updated_at();

create table public.pet_health (
  pet_id              uuid primary key references public.pets(id) on delete cascade,
  microchip_id        text check (microchip_id is null or microchip_id ~ '^[0-9A-Za-z]{9,15}$'),
  insurance_status    public.insurance_status not null default 'unknown',
  insurance_provider  text,
  medical_notes       text,
  allergies           text[] not null default '{}',
  vet_clinic          text,
  vet_name            text,
  vet_phone           text,
  updated_at          timestamptz not null default now()
);
create trigger pet_health_updated before update on public.pet_health
  for each row execute function public.set_updated_at();

create table public.pet_medications (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets(id) on delete cascade,
  name          text not null,
  dose          text,
  frequency     text not null default 'daily' check (frequency in ('daily', 'twice_daily', 'weekly', 'as_needed')),
  times         time[] not null default '{}',        -- e.g. {08:00, 20:00}
  instructions  text,
  start_on      date,
  end_on        date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index pet_medications_pet on public.pet_medications (pet_id);
create trigger pet_medications_updated before update on public.pet_medications
  for each row execute function public.set_updated_at();

-- ---------- Bookings ---------------------------------------------------------
create table public.bookings (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null references public.profiles(id),
  carer_id                uuid not null references public.carer_profiles(user_id),
  city_id                 uuid not null references public.cities(id),
  service_id              uuid not null references public.services(id),
  status                  public.booking_status not null default 'requested',
  start_at                timestamptz not null,
  end_at                  timestamptz not null,
  quantity                smallint not null default 1 check (quantity between 1 and 60),  -- visits / walks / nights / trips
  notes                   text,
  -- Pricing is computed by the database on insert; clients cannot set it.
  currency                char(3) not null default 'CAD',
  unit_rate_cents         integer not null default 0,
  subtotal_cents          integer not null default 0,
  tax_breakdown           jsonb not null default '[]'::jsonb,   -- [{"code":"GST","rate":0.05,"cents":250}]
  tax_cents               integer not null default 0,
  total_cents             integer not null default 0,
  commission_rate         numeric(5,4) not null default 0,
  commission_cents        integer not null default 0,
  carer_payout_cents      integer not null default 0,
  stripe_payment_intent_id text,
  stripe_charge_id        text,
  paid_at                 timestamptz,
  refunded_cents          integer not null default 0,
  -- lifecycle stamps
  completed_at            timestamptz,
  cancelled_at            timestamptz,
  cancelled_by            uuid references public.profiles(id),
  cancel_reason           text,
  disputed_at             timestamptz,
  disputed_by             uuid references public.profiles(id),
  dispute_reason          text,
  dispute_resolution      text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (end_at > start_at)
);
create index bookings_owner on public.bookings (owner_id, start_at desc);
create index bookings_carer on public.bookings (carer_id, start_at desc);
create index bookings_status on public.bookings (status);
create trigger bookings_updated before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.booking_pets (
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  pet_id      uuid not null references public.pets(id) on delete cascade,
  primary key (booking_id, pet_id)
);
create index booking_pets_pet on public.booking_pets (pet_id);

-- Insert: validate the request and compute the price from the carer's rate and
-- the city's tax / commission configuration.
create function public.bookings_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_city      public.cities;
  v_carer     public.carer_profiles;
  v_rate      integer;
  v_comp      jsonb;
  v_amt       integer;
  v_taxes     jsonb := '[]'::jsonb;
  v_tax_total integer := 0;
begin
  if not public.is_privileged() then
    new.owner_id := auth.uid();
    new.status := 'requested';
    new.stripe_payment_intent_id := null; new.stripe_charge_id := null; new.paid_at := null;
    new.refunded_cents := 0;
  end if;

  select * into v_carer from public.carer_profiles where user_id = new.carer_id;
  if not found or v_carer.status <> 'approved' then raise exception 'carer_not_available'; end if;

  select * into v_city from public.cities where id = v_carer.city_id and is_active;
  if not found then raise exception 'city_not_active'; end if;

  if not exists (select 1 from public.city_services where city_id = v_city.id and service_id = new.service_id and is_enabled) then
    raise exception 'service_not_available_in_city';
  end if;

  select rate_cents into v_rate from public.carer_services
   where carer_id = new.carer_id and service_id = new.service_id and is_active;
  if v_rate is null then raise exception 'service_not_offered'; end if;

  if new.start_at <= now() then raise exception 'start_in_past'; end if;

  new.city_id := v_city.id;
  new.currency := v_city.currency;
  new.unit_rate_cents := v_rate;
  new.subtotal_cents := v_rate * new.quantity;

  for v_comp in select * from jsonb_array_elements(v_city.tax_components) loop
    v_amt := round(new.subtotal_cents * (v_comp->>'rate')::numeric)::integer;
    v_taxes := v_taxes || jsonb_build_object('code', v_comp->>'code', 'rate', (v_comp->>'rate')::numeric, 'cents', v_amt);
    v_tax_total := v_tax_total + v_amt;
  end loop;

  new.tax_breakdown := v_taxes;
  new.tax_cents := v_tax_total;
  new.total_cents := new.subtotal_cents + v_tax_total;
  new.commission_rate := v_city.commission_rate;
  new.commission_cents := round(new.subtotal_cents * v_city.commission_rate)::integer;
  new.carer_payout_cents := new.subtotal_cents - new.commission_cents;
  return new;
end $$;
create trigger bookings_insert_guard before insert on public.bookings
  for each row execute function public.bookings_before_insert();

-- Update: who may move a booking to which status, and which fields are frozen.
create function public.bookings_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_is_owner boolean;
  v_is_carer boolean;
begin
  if not public.is_privileged() then
    -- frozen fields (price, parties, payment ids, timestamps)
    new.owner_id := old.owner_id;           new.carer_id := old.carer_id;
    new.city_id := old.city_id;             new.service_id := old.service_id;
    new.start_at := old.start_at;           new.end_at := old.end_at;
    new.quantity := old.quantity;           new.currency := old.currency;
    new.unit_rate_cents := old.unit_rate_cents;
    new.subtotal_cents := old.subtotal_cents;
    new.tax_breakdown := old.tax_breakdown; new.tax_cents := old.tax_cents;
    new.total_cents := old.total_cents;
    new.commission_rate := old.commission_rate;
    new.commission_cents := old.commission_cents;
    new.carer_payout_cents := old.carer_payout_cents;
    new.stripe_payment_intent_id := old.stripe_payment_intent_id;
    new.stripe_charge_id := old.stripe_charge_id;
    new.paid_at := old.paid_at;             new.refunded_cents := old.refunded_cents;
    new.dispute_resolution := old.dispute_resolution;

    if new.status is distinct from old.status then
      v_is_owner := v_uid = old.owner_id;
      v_is_carer := v_uid = old.carer_id;
      if not (
           (v_is_carer and old.status = 'requested' and new.status in ('accepted', 'declined'))
        or (v_is_carer and old.status = 'confirmed' and new.status = 'in_progress'
            and now() >= old.start_at - interval '1 hour')
        or (v_is_carer and old.status in ('confirmed', 'in_progress') and new.status = 'completed'
            and now() >= old.start_at)
        or (v_is_carer and old.status in ('confirmed', 'in_progress') and new.status = 'cancelled')
        or (v_is_owner and old.status in ('requested', 'accepted', 'payment_failed', 'confirmed')
            and new.status = 'cancelled')
        or (v_is_owner and old.status = 'completed' and new.status = 'disputed'
            and old.completed_at > now() - interval '7 days')
      ) then
        raise exception 'invalid_booking_transition: % -> %', old.status, new.status using errcode = '42501';
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'completed' then new.completed_at := now();
    elsif new.status = 'cancelled' then new.cancelled_at := now(); new.cancelled_by := coalesce(v_uid, new.cancelled_by);
    elsif new.status = 'disputed' then new.disputed_at := now(); new.disputed_by := coalesce(v_uid, new.disputed_by);
    end if;
  end if;
  return new;
end $$;
create trigger bookings_update_guard before update on public.bookings
  for each row execute function public.bookings_before_update();

-- Pets can only be attached to a new request, and must belong to the booking's owner.
create function public.booking_pets_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.bookings b
      join public.pets p on p.owner_id = b.owner_id
     where b.id = new.booking_id and p.id = new.pet_id and p.archived_at is null
       and (b.status = 'requested' or public.is_privileged())
  ) then
    raise exception 'invalid_booking_pet';
  end if;
  return new;
end $$;
create trigger booking_pets_guard before insert on public.booking_pets
  for each row execute function public.booking_pets_before_insert();

-- ---------- Care history (append-only) --------------------------------------
create table public.care_history_events (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  booking_id   uuid references public.bookings(id) on delete set null,
  actor_id     uuid references public.profiles(id) on delete set null,
  type         public.history_event_type not null,
  title        text,
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index care_history_pet on public.care_history_events (pet_id, occurred_at desc);

-- Owners may add their own vet visits / notes. Everything else is written by
-- the triggers below, so the timeline can't be forged from the app.
create function public.care_history_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_privileged() and coalesce(current_setting('app.history_writer', true), '') <> '1' then
    if new.type not in ('vet_visit', 'note')
       or not exists (select 1 from public.pets where id = new.pet_id and owner_id = auth.uid()) then
      raise exception 'history_event_not_allowed' using errcode = '42501';
    end if;
    new.owner_id := auth.uid();
    new.actor_id := auth.uid();
    new.booking_id := null;
  end if;
  return new;
end $$;
create trigger care_history_guard before insert on public.care_history_events
  for each row execute function public.care_history_before_insert();
create trigger care_history_append_only before update or delete on public.care_history_events
  for each row execute function public.prevent_modification();

-- Internal: write a history event for every pet on a booking.
create function public.log_booking_event(p_booking uuid, p_type public.history_event_type,
                                         p_title text, p_payload jsonb, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.history_writer', '1', true);
  insert into public.care_history_events (pet_id, owner_id, booking_id, actor_id, type, title, payload)
  select bp.pet_id, b.owner_id, b.id, p_actor, p_type, p_title, p_payload
    from public.booking_pets bp join public.bookings b on b.id = bp.booking_id
   where b.id = p_booking;
  perform set_config('app.history_writer', '', true);
end $$;

create function public.bookings_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.log_booking_event(new.id, 'booking_completed', null,
      jsonb_build_object('service_id', new.service_id, 'carer_id', new.carer_id), new.carer_id);
  end if;
  return new;
end $$;
create trigger bookings_after_update after update on public.bookings
  for each row execute function public.bookings_after_update();

-- ---------- Visit reports (append-only) -------------------------------------
create table public.visit_reports (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings(id) on delete cascade,
  carer_id            uuid not null references public.profiles(id) on delete cascade,
  summary             text,
  -- {"fed": true, "walked": true, "meds_given": false, "water_refreshed": true}
  checklist           jsonb not null default '{}'::jsonb,
  medications_given   uuid[] not null default '{}',   -- pet_medications ids
  photo_paths         text[] not null default '{}',   -- 'visit-photos' bucket
  visit_started_at    timestamptz,
  visit_ended_at      timestamptz,
  created_at          timestamptz not null default now()
);
create index visit_reports_booking on public.visit_reports (booking_id, created_at);
create trigger visit_reports_append_only before update or delete on public.visit_reports
  for each row execute function public.prevent_modification();

create function public.visit_reports_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_privileged() then new.carer_id := auth.uid(); end if;
  if not exists (select 1 from public.bookings
                  where id = new.booking_id and carer_id = new.carer_id
                    and status in ('confirmed', 'in_progress', 'completed')) then
    raise exception 'report_not_allowed_for_booking' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger visit_reports_guard before insert on public.visit_reports
  for each row execute function public.visit_reports_before_insert();

create function public.visit_reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_med uuid;
begin
  perform public.log_booking_event(new.booking_id, 'visit_report', null,
    jsonb_build_object('report_id', new.id, 'checklist', new.checklist, 'photo_count', cardinality(new.photo_paths)),
    new.carer_id);

  foreach v_med in array new.medications_given loop
    perform set_config('app.history_writer', '1', true);
    insert into public.care_history_events (pet_id, owner_id, booking_id, actor_id, type, title, payload)
    select m.pet_id, b.owner_id, b.id, new.carer_id, 'medication_given', m.name,
           jsonb_build_object('report_id', new.id, 'medication_id', m.id, 'dose', m.dose)
      from public.pet_medications m
      join public.booking_pets bp on bp.pet_id = m.pet_id and bp.booking_id = new.booking_id
      join public.bookings b on b.id = bp.booking_id
     where m.id = v_med;
    perform set_config('app.history_writer', '', true);
  end loop;
  return new;
end $$;
create trigger visit_reports_after_insert after insert on public.visit_reports
  for each row execute function public.visit_reports_after_insert();

-- ---------- Wellbeing scores (append-only, 1 = poor ... 5 = excellent) -------
create table public.wellbeing_scores (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets(id) on delete cascade,
  booking_id       uuid not null references public.bookings(id) on delete cascade,
  visit_report_id  uuid not null references public.visit_reports(id) on delete cascade,
  metric           public.wellbeing_metric not null,
  score            smallint not null check (score between 1 and 5),
  recorded_by      uuid not null references public.profiles(id) on delete cascade,
  recorded_at      timestamptz not null default now(),
  unique (visit_report_id, pet_id, metric)
);
create index wellbeing_pet_metric on public.wellbeing_scores (pet_id, metric, recorded_at desc);
create trigger wellbeing_append_only before update or delete on public.wellbeing_scores
  for each row execute function public.prevent_modification();

create function public.wellbeing_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_report public.visit_reports;
begin
  select * into v_report from public.visit_reports where id = new.visit_report_id;
  if not found then raise exception 'report_not_found'; end if;
  if not public.is_privileged() and v_report.carer_id <> auth.uid() then
    raise exception 'score_not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.booking_pets where booking_id = v_report.booking_id and pet_id = new.pet_id) then
    raise exception 'pet_not_on_booking';
  end if;
  new.booking_id := v_report.booking_id;
  new.recorded_by := v_report.carer_id;
  return new;
end $$;
create trigger wellbeing_guard before insert on public.wellbeing_scores
  for each row execute function public.wellbeing_before_insert();

-- ---------- Concern flags (append-only) -------------------------------------
create table public.concern_flags (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  pet_id       uuid not null references public.pets(id) on delete cascade,
  carer_id     uuid not null references public.profiles(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  category     public.concern_category not null default 'health',
  severity     public.concern_severity not null default 'concern',
  notes        text not null check (length(trim(notes)) > 0),
  photo_paths  text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index concern_flags_owner on public.concern_flags (owner_id, created_at desc);
create index concern_flags_pet on public.concern_flags (pet_id, created_at desc);
create trigger concern_flags_append_only before update or delete on public.concern_flags
  for each row execute function public.prevent_modification();

create function public.concern_flags_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if not public.is_privileged() then new.carer_id := auth.uid(); end if;
  select b.owner_id into v_owner
    from public.bookings b join public.booking_pets bp on bp.booking_id = b.id
   where b.id = new.booking_id and b.carer_id = new.carer_id and bp.pet_id = new.pet_id
     and b.status in ('confirmed', 'in_progress', 'completed');
  if v_owner is null then raise exception 'flag_not_allowed_for_booking' using errcode = '42501'; end if;
  new.owner_id := v_owner;
  return new;
end $$;
create trigger concern_flags_guard before insert on public.concern_flags
  for each row execute function public.concern_flags_before_insert();

create function public.concern_flags_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.history_writer', '1', true);
  insert into public.care_history_events (pet_id, owner_id, booking_id, actor_id, type, title, payload)
  values (new.pet_id, new.owner_id, new.booking_id, new.carer_id, 'concern_flag', new.category::text,
          jsonb_build_object('flag_id', new.id, 'severity', new.severity, 'notes', new.notes));
  perform set_config('app.history_writer', '', true);
  return new;
end $$;
create trigger concern_flags_after_insert after insert on public.concern_flags
  for each row execute function public.concern_flags_after_insert();

-- What the owner did about a flag (one-tap actions) and how it ended.
create table public.concern_flag_actions (
  id                uuid primary key default gen_random_uuid(),
  flag_id           uuid not null references public.concern_flags(id) on delete cascade,
  actor_id          uuid not null references public.profiles(id) on delete cascade,
  action            public.flag_action_type not null,
  note              text,
  taxi_booking_id   uuid references public.bookings(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index flag_actions_flag on public.concern_flag_actions (flag_id, created_at);
create trigger flag_actions_append_only before update or delete on public.concern_flag_actions
  for each row execute function public.prevent_modification();

create function public.flag_actions_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_privileged() then
    new.actor_id := auth.uid();
    if not exists (select 1 from public.concern_flags f where f.id = new.flag_id and f.owner_id = auth.uid()) then
      raise exception 'flag_action_not_allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger flag_actions_guard before insert on public.concern_flag_actions
  for each row execute function public.flag_actions_before_insert();

create function public.flag_actions_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f public.concern_flags;
begin
  select * into f from public.concern_flags where id = new.flag_id;
  perform set_config('app.history_writer', '1', true);
  insert into public.care_history_events (pet_id, owner_id, booking_id, actor_id, type, title, payload)
  values (f.pet_id, f.owner_id, f.booking_id, new.actor_id, 'flag_action', new.action::text,
          jsonb_build_object('flag_id', f.id, 'action', new.action, 'note', new.note));
  perform set_config('app.history_writer', '', true);
  return new;
end $$;
create trigger flag_actions_after_insert after insert on public.concern_flag_actions
  for each row execute function public.flag_actions_after_insert();

-- ---------- Reviews ----------------------------------------------------------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.bookings(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  carer_id    uuid not null references public.carer_profiles(user_id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (length(comment) <= 2000),
  created_at  timestamptz not null default now()
);
create index reviews_carer on public.reviews (carer_id, created_at desc);

create function public.reviews_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found or b.status <> 'completed' then raise exception 'booking_not_completed'; end if;
  if not public.is_privileged() and b.owner_id <> auth.uid() then
    raise exception 'review_not_allowed' using errcode = '42501';
  end if;
  new.owner_id := b.owner_id;
  new.carer_id := b.carer_id;
  return new;
end $$;
create trigger reviews_guard before insert on public.reviews
  for each row execute function public.reviews_before_insert();

create function public.reviews_refresh_rating() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_carer uuid := coalesce(new.carer_id, old.carer_id);
begin
  perform set_config('app.bypass_guard', '1', true);
  update public.carer_profiles cp
     set rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where carer_id = v_carer), 0),
         rating_count = (select count(*) from public.reviews where carer_id = v_carer)
   where cp.user_id = v_carer;
  perform set_config('app.bypass_guard', '', true);
  return null;
end $$;
create trigger reviews_rating after insert or delete on public.reviews
  for each row execute function public.reviews_refresh_rating();

-- ---------- Payouts (written only by the server / Stripe webhooks) ----------
create table public.payouts (
  id                  uuid primary key default gen_random_uuid(),
  carer_id            uuid not null references public.carer_profiles(user_id),
  amount_cents        integer not null check (amount_cents > 0),
  currency            char(3) not null,
  status              public.payout_status not null default 'pending',
  stripe_transfer_id  text,
  stripe_payout_id    text,
  period_start        date,
  period_end          date,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);
create index payouts_carer on public.payouts (carer_id, created_at desc);

-- ---------- Waitlist ---------------------------------------------------------
create table public.waitlist (
  id               uuid primary key default gen_random_uuid(),
  email            text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  city_id          uuid references public.cities(id) on delete cascade,
  requested_city   text,                                -- free text if their city isn't listed
  country_code     text references public.countries(code),
  postal_code      text,
  interest         text not null default 'owner' check (interest in ('owner', 'carer')),
  preferred_language text references public.languages(code),
  user_id          uuid references public.profiles(id) on delete set null,
  consent_at       timestamptz not null default now(),   -- consent to be contacted (CASL/PIPEDA)
  created_at       timestamptz not null default now(),
  check (city_id is not null or requested_city is not null)
);
create unique index waitlist_unique on public.waitlist
  (lower(email), coalesce(city_id::text, lower(requested_city)), interest);

-- ---------- Push tokens ------------------------------------------------------
create table public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null unique,
  platform    text check (platform in ('ios', 'android', 'web')),
  language    text references public.languages(code),   -- so notifications can be localised
  created_at  timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);
