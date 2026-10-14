-- =============================================================================
-- 0005  Application rules (Phase 2)
--  * A carer's application is LOCKED while it is under review ('pending') or
--    suspended: no edits to the profile, documents, references or rates.
--  * An admin can only approve a carer who has at least one verified,
--    unexpired credential. Rejection needs a reason the carer can read.
-- =============================================================================

create function public.carer_can_edit(p_carer uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (select 1 from public.carer_profiles
                  where user_id = p_carer and status in ('draft', 'rejected', 'approved'));
end $$;

-- Profile row itself
drop policy carer_profiles_update on public.carer_profiles;
create policy carer_profiles_update on public.carer_profiles for update to authenticated
  using (user_id = auth.uid() and status in ('draft', 'rejected', 'approved'))
  with check (user_id = auth.uid());

-- Credentials
drop policy credentials_insert on public.credentials;
create policy credentials_insert on public.credentials for insert to authenticated
  with check (carer_id = auth.uid() and public.carer_can_edit(carer_id));
drop policy credentials_update on public.credentials;
create policy credentials_update on public.credentials for update to authenticated
  using (carer_id = auth.uid() and status <> 'verified' and public.carer_can_edit(carer_id))
  with check (carer_id = auth.uid());
drop policy credentials_delete on public.credentials;
create policy credentials_delete on public.credentials for delete to authenticated
  using (carer_id = auth.uid() and status <> 'verified' and public.carer_can_edit(carer_id));

-- References
drop policy carer_references_own on public.carer_references;
create policy carer_references_select on public.carer_references for select to authenticated
  using (carer_id = auth.uid());
create policy carer_references_write on public.carer_references for all to authenticated
  using (carer_id = auth.uid() and public.carer_can_edit(carer_id))
  with check (carer_id = auth.uid() and public.carer_can_edit(carer_id));

-- Rates
drop policy carer_services_write on public.carer_services;
create policy carer_services_write on public.carer_services for all to authenticated
  using (carer_id = auth.uid() and public.carer_can_edit(carer_id))
  with check (carer_id = auth.uid() and public.carer_can_edit(carer_id));

-- Admin decision rules (extends guard_carer_profile from 0001)
create or replace function public.guard_carer_profile() returns trigger
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
    if new.status is distinct from old.status then
      if new.status = 'approved' and public.is_admin() and not exists (
           select 1 from public.credentials c
            where c.carer_id = new.user_id and c.status = 'verified'
              and (c.expires_on is null or c.expires_on >= current_date)) then
        raise exception 'approval_needs_verified_credential';
      end if;
      if new.status = 'rejected' and public.is_admin() and coalesce(trim(new.rejection_reason), '') = '' then
        raise exception 'rejection_needs_reason';
      end if;
      if new.status = 'approved' then new.rejection_reason := null; end if;
      if public.is_admin() then
        new.reviewed_at := now();
        new.reviewed_by := auth.uid();
      end if;
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
    if new.city_id is null or coalesce(new.display_name, '') = '' or coalesce(new.bio, '') = ''
       or new.postal_code is null then
      raise exception 'application_incomplete_profile';
    end if;
    if new.background_check_consent_at is null or new.terms_accepted_at is null then
      raise exception 'application_missing_consent';
    end if;
    if v_creds < 1 then raise exception 'application_needs_credential'; end if;
    if v_refs < 2 then raise exception 'application_needs_two_references'; end if;   -- policy: change here
    if not exists (select 1 from public.carer_services where carer_id = new.user_id and is_active) then
      raise exception 'application_needs_service';
    end if;
    new.submitted_at := now();
  end if;
  return new;
end $$;
