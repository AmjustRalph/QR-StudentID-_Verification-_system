-- =============================================================================
-- QR-SIDVS · 0005_guard_service_role.sql
-- Fixes a bug in the admin-only column guards from 0002_rls.sql
-- (guard_student_columns) and 0004_staff_status.sql (guard_user_status): both
-- checked public.is_admin(), which reads auth.uid() — and auth.uid() is NULL
-- under a service_role request (the service key carries no `sub` claim), so a
-- legitimate write from an Edge Function using the service_role key was
-- incorrectly rejected by these triggers. Confirmed by testing directly: a
-- service-role update to users.status was rejected before this fix.
--
-- BYPASSRLS exempts service_role from RLS policies, but NOT from triggers —
-- triggers fire regardless of who issues the statement — so this has to be
-- handled explicitly in the guard functions rather than relying on the RLS
-- bypass to cover it.
--
-- Run after 0004_staff_status.sql. Idempotent: safe to re-run.
-- =============================================================================

create or replace function public.guard_student_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.student_id_number is distinct from old.student_id_number
     or new.status is distinct from old.status
     or new.level is distinct from old.level
     or new.programme is distinct from old.programme then
    raise exception 'Only an administrator may change student_id_number, status, level or programme';
  end if;

  return new;
end;
$$;

create or replace function public.guard_user_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only an administrator may change account status';
  end if;
  return new;
end;
$$;
