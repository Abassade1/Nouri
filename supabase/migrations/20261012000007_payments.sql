-- =============================================================================
-- 0007  Payments (Phase 5: Stripe Connect)
--
-- Money model ("separate charges and transfers"):
--   1. Owner confirms an ACCEPTED booking and pays the full total to the platform.
--   2. After the visit is completed and a hold period passes (per city), the platform
--      transfers the carer's payout (subtotal minus commission) to their Stripe account.
--      Tax and commission stay with the platform.
--   3. Stripe pays the carer's balance out to their bank on their own schedule.
-- Confirmed bookings can only be cancelled through the server (refund rules), never
-- by editing the row from the app.
-- =============================================================================

-- ---------- Per-city money settings ------------------------------------------
alter table public.cities
  add column cancellation_full_refund_hours integer not null default 24 check (cancellation_full_refund_hours >= 0),
  add column cancellation_late_refund_pct   integer not null default 50 check (cancellation_late_refund_pct between 0 and 100),
  add column payout_hold_hours              integer not null default 24 check (payout_hold_hours >= 0);

comment on column public.cities.cancellation_full_refund_hours is
  'Owner cancels at least this many hours before the start: full refund. Carer cancellations are always fully refunded.';
comment on column public.cities.cancellation_late_refund_pct is
  'Owner cancels later than that: this percentage is refunded. PLACEHOLDER policy: decide with your advisors.';
comment on column public.cities.payout_hold_hours is
  'Hours after a visit is completed before the carer''s payout is released (time for the owner to raise a concern).';

-- ---------- Booking payment fields ------------------------------------------
alter table public.bookings
  add column stripe_transfer_id text,
  add column transferred_at     timestamptz;
create index bookings_release on public.bookings (completed_at)
  where status = 'completed' and stripe_transfer_id is null;

-- ---------- Stripe bookkeeping (server only: RLS on, no policies) -----------
create table public.stripe_customers (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  customer_id  text not null unique,
  created_at   timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;

-- Webhook deliveries already handled (Stripe may send the same event twice).
create table public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

create unique index payouts_stripe_payout_id on public.payouts (stripe_payout_id);  -- nulls stay allowed
revoke all on public.stripe_customers, public.stripe_events from anon, authenticated;

-- ---------- Only carers who can be paid are bookable -------------------------
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
             where cs.carer_id = cp.user_id and cs.is_active), '[]'::jsonb) as services
from public.carer_profiles cp
join public.profiles p on p.id = cp.user_id
join public.cities ci on ci.id = cp.city_id and ci.is_active
where cp.status = 'approved' and cp.payouts_enabled;

-- ---------- Booking creation: carer must be payable --------------------------
create or replace function public.bookings_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_city      public.cities;
  v_carer     public.carer_profiles;
  v_rate      integer;
  v_unit      public.rate_unit;
  v_comp      jsonb;
  v_amt       integer;
  v_taxes     jsonb := '[]'::jsonb;
  v_tax_total integer := 0;
  v_local     timestamp;
  v_local_end timestamp;
begin
  if not public.is_privileged() then
    new.owner_id := auth.uid();
    new.status := 'requested';
    new.stripe_payment_intent_id := null; new.stripe_charge_id := null; new.paid_at := null;
    new.stripe_transfer_id := null; new.transferred_at := null;
    new.refunded_cents := 0;
  end if;

  select * into v_carer from public.carer_profiles where user_id = new.carer_id;
  if not found or v_carer.status <> 'approved' then raise exception 'carer_not_available'; end if;
  if not public.is_privileged() and not v_carer.payouts_enabled then raise exception 'carer_not_available'; end if;

  select * into v_city from public.cities where id = v_carer.city_id and is_active;
  if not found then raise exception 'city_not_active'; end if;

  if not exists (select 1 from public.city_services where city_id = v_city.id and service_id = new.service_id and is_enabled) then
    raise exception 'service_not_available_in_city';
  end if;

  select cs.rate_cents, s.rate_unit into v_rate, v_unit
    from public.carer_services cs join public.services s on s.id = cs.service_id
   where cs.carer_id = new.carer_id and cs.service_id = new.service_id and cs.is_active;
  if v_rate is null then raise exception 'service_not_offered'; end if;

  if new.start_at <= now() then raise exception 'start_in_past'; end if;

  if not public.is_privileged() then
    if new.start_at < now() + interval '2 hours' then raise exception 'start_too_soon'; end if;

    v_local := new.start_at at time zone v_city.timezone;
    v_local_end := new.end_at at time zone v_city.timezone;
    if not exists (
      select 1 from public.availability a
       where a.carer_id = new.carer_id
         and a.weekday = extract(dow from v_local)::int
         and v_local::time >= a.start_time and v_local::time < a.end_time
         and (v_unit = 'per_night'
              or (v_local_end::date = v_local::date and v_local_end::time <= a.end_time))
    ) then
      raise exception 'outside_availability';
    end if;

    if public.carer_has_conflict(new.carer_id, new.start_at, new.end_at, null) then
      raise exception 'carer_unavailable';
    end if;
  end if;

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

-- ---------- Status changes: money-touching ones are server-only --------------
create or replace function public.bookings_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_is_owner boolean;
  v_is_carer boolean;
begin
  if not public.is_privileged() then
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
    new.stripe_transfer_id := old.stripe_transfer_id;
    new.transferred_at := old.transferred_at;
    new.paid_at := old.paid_at;             new.refunded_cents := old.refunded_cents;
    new.dispute_resolution := old.dispute_resolution;

    if new.status is distinct from old.status then
      v_is_owner := v_uid = old.owner_id;
      v_is_carer := v_uid = old.carer_id;
      -- Paid bookings (confirmed / in progress) can NOT be cancelled from the app: that goes
      -- through the cancel-booking server function so the refund is always applied.
      if not (
           (v_is_carer and old.status = 'requested' and new.status in ('accepted', 'declined'))
        or (v_is_carer and old.status = 'confirmed' and new.status = 'in_progress'
            and now() >= old.start_at - interval '1 hour')
        or (v_is_carer and old.status in ('confirmed', 'in_progress') and new.status = 'completed'
            and now() >= old.start_at)
        or (v_is_owner and old.status in ('requested', 'accepted', 'payment_failed') and new.status = 'cancelled')
        or (v_is_owner and old.status = 'completed' and new.status = 'disputed'
            and old.completed_at > now() - interval '7 days')
      ) then
        raise exception 'invalid_booking_transition: % -> %', old.status, new.status using errcode = '42501';
      end if;
      if v_is_carer and new.status = 'accepted' and not exists (
           select 1 from public.carer_profiles where user_id = v_uid and payouts_enabled) then
        raise exception 'payouts_not_enabled' using errcode = '42501';
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
