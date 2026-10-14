-- =============================================================================
-- 0009  Admin dispute & concern-flag handling
--  * The carer is told when an owner opens a dispute (their payout is paused).
--  * Both people are told when an admin decides it.
--  * Deciding a dispute must not re-announce "visit completed" or write a second
--    "completed" entry into the pet's care history.
-- =============================================================================

create or replace function public.bookings_notify() returns trigger
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
    -- An admin has decided a dispute: tell both people the outcome, nothing else.
    if old.status = 'disputed' then
      perform public.notify(new.owner_id, 'dispute_resolved', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
      perform public.notify(new.carer_id, 'dispute_resolved', jsonb_build_object('booking_id', new.id, 'route', v_carer_route));
      return new;
    end if;

    case new.status
      when 'accepted' then perform public.notify(new.owner_id, 'booking_accepted', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
      when 'declined' then perform public.notify(new.owner_id, 'booking_declined', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
      when 'confirmed' then perform public.notify(new.carer_id, 'booking_confirmed', jsonb_build_object('booking_id', new.id, 'route', v_carer_route));
      when 'cancelled' then
        if new.cancelled_by is distinct from new.owner_id then
          perform public.notify(new.owner_id, 'booking_cancelled', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
        end if;
        if new.cancelled_by is distinct from new.carer_id then
          perform public.notify(new.carer_id, 'booking_cancelled', jsonb_build_object('booking_id', new.id, 'route', v_carer_route));
        end if;
      when 'completed' then perform public.notify(new.owner_id, 'visit_completed', jsonb_build_object('booking_id', new.id, 'route', v_owner_route));
      when 'disputed' then perform public.notify(new.carer_id, 'booking_disputed', jsonb_build_object('booking_id', new.id, 'route', v_carer_route));
      else null;
    end case;
  end if;
  return new;
end $$;

-- Care history: log "visit completed" once, not again when a dispute is decided in the carer's favour.
create or replace function public.bookings_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status not in ('completed', 'disputed') then
    perform public.log_booking_event(new.id, 'booking_completed', null,
      jsonb_build_object('service_id', new.service_id, 'carer_id', new.carer_id), new.carer_id);
  end if;
  return new;
end $$;

-- Admin work queues: speed up "open disputes" and "unanswered flags".
create index if not exists bookings_disputed on public.bookings (disputed_at desc) where status = 'disputed';
create index if not exists concern_flags_created on public.concern_flags (created_at desc);
