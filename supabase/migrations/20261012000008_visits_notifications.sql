-- =============================================================================
-- 0008  Visit reports, concern flags, reviews, notifications (Phase 6)
--  * submit_visit_report(): one atomic call, so a report never exists without its scores.
--  * notifications: a queue filled by database triggers. A server function (send-push) turns
--    rows into localised push messages; the table doubles as an inbox for later.
--  * Owners' "book a pet taxi" action must point at a booking the owner actually owns.
--  * Credential-expiry reminders for carers (run daily).
-- =============================================================================

-- ---------- Atomic visit report ---------------------------------------------
-- SECURITY INVOKER: every insert below runs as the carer and passes the same row-level
-- rules and guard triggers as inserting by hand.
create function public.submit_visit_report(
  p_booking   uuid,
  p_summary   text,
  p_checklist jsonb,
  p_meds      uuid[],
  p_photos    text[],
  p_started   timestamptz,
  p_ended     timestamptz,
  p_scores    jsonb          -- [{"pet_id": "...", "metric": "health", "score": 4}, ...]
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_report uuid;
  v_item   jsonb;
begin
  insert into public.visit_reports (booking_id, carer_id, summary, checklist, medications_given, photo_paths, visit_started_at, visit_ended_at)
  values (p_booking, auth.uid(), nullif(trim(coalesce(p_summary, '')), ''), coalesce(p_checklist, '{}'::jsonb),
          coalesce(p_meds, '{}'), coalesce(p_photos, '{}'), p_started, p_ended)
  returning id into v_report;

  for v_item in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) loop
    insert into public.wellbeing_scores (pet_id, booking_id, visit_report_id, metric, score, recorded_by)
    values ((v_item->>'pet_id')::uuid, p_booking, v_report, (v_item->>'metric')::public.wellbeing_metric,
            (v_item->>'score')::smallint, auth.uid());
  end loop;
  return v_report;
end $$;

-- ---------- Taxi action must reference the owner's own booking ---------------
create or replace function public.flag_actions_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_privileged() then
    new.actor_id := auth.uid();
    if not exists (select 1 from public.concern_flags f where f.id = new.flag_id and f.owner_id = auth.uid()) then
      raise exception 'flag_action_not_allowed' using errcode = '42501';
    end if;
    if new.taxi_booking_id is not null and not exists (
         select 1 from public.bookings b where b.id = new.taxi_booking_id and b.owner_id = auth.uid()) then
      raise exception 'taxi_booking_not_yours' using errcode = '42501';
    end if;
  end if;
  if new.action = 'booked_pet_taxi' and new.taxi_booking_id is null then
    raise exception 'taxi_booking_required';
  end if;
  return new;
end $$;

-- ---------- Notifications -----------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  priority    text not null default 'default' check (priority in ('default', 'high')),
  data        jsonb not null default '{}'::jsonb,   -- ids + a "route" the app opens when tapped
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  read_at     timestamptz
);
create index notifications_unsent on public.notifications (created_at) where sent_at is null;
create index notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, delete on public.notifications from authenticated, anon;
revoke all on public.notifications from anon;

create function public.notify(p_user uuid, p_kind text, p_data jsonb, p_priority text default 'default') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is not null then
    insert into public.notifications (user_id, kind, priority, data) values (p_user, p_kind, p_priority, coalesce(p_data, '{}'::jsonb));
  end if;
end $$;
revoke execute on function public.notify(uuid, text, jsonb, text) from public, anon, authenticated;

-- bookings: requested / accepted / declined / confirmed / cancelled / completed
create function public.bookings_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner_route text := '/owner/bookings/' || new.id;
  v_carer_route text := '/carer/bookings/' || new.id;
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.carer_id, 'booking_requested', jsonb_build_object('booking_id', new.id, 'route', v_carer_route));
    return new;
  end if;
  if new.status is distinct from old.status then
    case new.status
      when 'accepted' then perform public.notify(new.owner_id, 'booking_accepted', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
      when 'declined' then perform public.notify(new.owner_id, 'booking_declined', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
      when 'confirmed' then
        perform public.notify(new.carer_id, 'booking_confirmed', jsonb_build_object('booking_id', new.id, 'route', v_carer_route));
      when 'cancelled' then
        if new.cancelled_by is distinct from new.owner_id then
          perform public.notify(new.owner_id, 'booking_cancelled', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
        end if;
        if new.cancelled_by is distinct from new.carer_id then
          perform public.notify(new.carer_id, 'booking_cancelled', jsonb_build_object('booking_id', new.id, 'route', v_carer_route));
        end if;
      when 'completed' then perform public.notify(new.owner_id, 'visit_completed', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
      else null;
    end case;
  end if;
  return new;
end $$;
create trigger bookings_notify after insert or update on public.bookings
  for each row execute function public.bookings_notify();

create function public.visit_reports_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.bookings where id = new.booking_id;
  perform public.notify(v_owner, 'visit_report', jsonb_build_object('booking_id', new.booking_id, 'report_id', new.id,
                        'route', '/owner/bookings/' || new.booking_id));
  return new;
end $$;
create trigger visit_reports_notify after insert on public.visit_reports
  for each row execute function public.visit_reports_notify();

-- Concern flags: the owner is told immediately (high priority).
create function public.concern_flags_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pet text;
begin
  select name into v_pet from public.pets where id = new.pet_id;
  perform public.notify(new.owner_id, 'concern_flag',
    jsonb_build_object('flag_id', new.id, 'pet_name', v_pet, 'severity', new.severity, 'route', '/owner/concern/' || new.id), 'high');
  return new;
end $$;
create trigger concern_flags_notify after insert on public.concern_flags
  for each row execute function public.concern_flags_notify();

create function public.reviews_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.carer_id, 'review_received', jsonb_build_object('review_id', new.id, 'rating', new.rating, 'route', '/carer/reviews'));
  return new;
end $$;
create trigger reviews_notify after insert on public.reviews
  for each row execute function public.reviews_notify();

create function public.carer_status_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public.notify(new.user_id, 'application_' || new.status::text, jsonb_build_object('route', '/carer/application'));
  end if;
  return new;
end $$;
create trigger carer_status_notify after update on public.carer_profiles
  for each row execute function public.carer_status_notify();

-- ---------- Credential expiry reminders (call daily) -------------------------
-- First reminder 30 days out, a second when 7 days remain. Returns how many were queued.
create function public.enqueue_expiry_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in
    select id, carer_id, title, expires_on from public.credentials
     where status = 'verified' and expires_on is not null
       and expires_on between current_date and current_date + 30
       and (expiry_reminded_at is null
            or (expires_on <= current_date + 7 and expiry_reminded_at < now() - interval '10 days'))
  loop
    perform public.notify(r.carer_id, 'credential_expiring',
      jsonb_build_object('credential_id', r.id, 'title', r.title, 'expires_on', r.expires_on, 'route', '/carer/application/credentials'));
    update public.credentials set expiry_reminded_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.enqueue_expiry_reminders() from public, anon, authenticated;

-- Waitlist: a little hygiene so the open form can't be abused with absurd values.
alter table public.waitlist add constraint waitlist_email_len check (length(email) <= 254);
alter table public.waitlist add constraint waitlist_city_text_len check (requested_city is null or length(requested_city) <= 120);
