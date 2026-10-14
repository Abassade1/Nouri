-- =============================================================================
-- 0014  Ask Nouri (AI assistant) and Nouri Plus (subscription)
--  * Nouri Plus is a Stripe subscription. Only the Stripe webhook writes `subscriptions`;
--    people can read their own row.
--  * Ask Nouri keeps each owner's conversation. Only the ask-nouri function writes it
--    (after checking the daily allowance); owners can read and clear their own.
--  * Free owners get 5 questions a day; Plus members are unlimited.
--  * Booking requests from Plus members are marked priority so carers see them first.
-- =============================================================================

create table public.subscriptions (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  stripe_subscription_id  text not null unique,
  status                  text not null,          -- Stripe's status: active, trialing, past_due, canceled, ...
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  updated_at              timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_own_read on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.subscriptions from anon, authenticated;

/** Whether someone currently has Nouri Plus. (Membership is not secret: carers see a badge on requests.) */
create function public.is_plus(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
     where s.user_id = p_user
       and s.status in ('active', 'trialing')
       and (s.current_period_end is null or s.current_period_end > now()));
$$;

-- Ask Nouri ----------------------------------------------------------------------
create table public.assistant_messages (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) between 1 and 8000),
  created_at  timestamptz not null default now()
);
create index assistant_messages_owner on public.assistant_messages (owner_id, created_at);
alter table public.assistant_messages enable row level security;
create policy assistant_messages_own_read on public.assistant_messages for select to authenticated
  using (owner_id = auth.uid());
create policy assistant_messages_own_clear on public.assistant_messages for delete to authenticated
  using (owner_id = auth.uid());
revoke insert, update on public.assistant_messages from anon, authenticated;

/**
 * Questions asked today (UTC) and the daily allowance; limit is null for Plus members.
 * People only ever see their own; the backend (service role) may ask about anyone.
 */
create function public.assistant_quota(p_user uuid default null)
returns table (used_today int, daily_limit int, is_plus boolean)
language sql stable security definer set search_path = '' as $$
  with u as (select case when public.is_privileged() then coalesce(p_user, auth.uid()) else auth.uid() end as id)
  select
    (select count(*)::int from public.assistant_messages m, u
      where m.owner_id = u.id and m.role = 'user' and m.created_at >= date_trunc('day', now())),
    case when public.is_plus((select id from u)) then null else 5 end,
    public.is_plus((select id from u));
$$;
revoke execute on function public.assistant_quota(uuid) from anon;

-- Priority requests ---------------------------------------------------------------
alter table public.bookings add column is_priority boolean not null default false;

-- Set from the owner's membership when the request is made; nobody can change it afterwards.
create function public.bookings_priority() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.is_priority := public.is_plus(new.owner_id);
  elsif new.is_priority is distinct from old.is_priority and not public.is_privileged() then
    new.is_priority := old.is_priority;
  end if;
  return new;
end $$;
create trigger bookings_priority before insert or update on public.bookings
  for each row execute function public.bookings_priority();
