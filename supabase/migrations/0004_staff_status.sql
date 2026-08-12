-- =============================================================================
-- QR-SIDVS · 0004_staff_status.sql
-- Adds an active/deactivated status to public.users, so a Staff account can be
-- disabled the same way a student's can — spec §3 only defines status on
-- students, but the same capability was requested for staff directly.
--
-- Mirrors the existing student pattern rather than inventing a new one:
-- deactivation blocks functional capability via RLS (starting sessions,
-- marking attendance, verifying exams) instead of banning the Supabase Auth
-- login outright — the same way a deactivated student's account still exists,
-- but their codes are rejected by verify-code.
--
-- Run after 0001-0003. Idempotent: safe to re-run.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'deactivated');
  end if;
end $$;

alter table public.users
  add column if not exists status public.account_status not null default 'active';

-- ---------------------------------------------------------------------------
-- Guard: only admin may change status. Role is already protected by the
-- `with check` on users_update_self (0002_rls.sql); this makes users' write
-- protection symmetric with guard_student_columns on public.students.
-- ---------------------------------------------------------------------------
create or replace function public.guard_user_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only an administrator may change account status';
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_status on public.users;
create trigger users_guard_status
  before update on public.users
  for each row execute function public.guard_user_status();

-- ---------------------------------------------------------------------------
-- Helper: is the calling staff member's own account active? Only ever gates
-- staff-authored writes — admin writes are unaffected by this check.
-- ---------------------------------------------------------------------------
create or replace function public.caller_is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status = 'active' from public.users where auth_user_id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Fold the active check into every staff-authored write.
-- ---------------------------------------------------------------------------
drop policy if exists attendance_sessions_staff_insert on public.attendance_sessions;
create policy attendance_sessions_staff_insert on public.attendance_sessions for insert to authenticated
  with check (
    public.app_role() = 'staff'
    and public.caller_is_active_staff()
    and lecturer_id = public.app_user_id()
    and public.teaches_course(course_id)
  );

drop policy if exists attendance_sessions_staff_update on public.attendance_sessions;
create policy attendance_sessions_staff_update on public.attendance_sessions for update to authenticated
  using (public.app_role() = 'staff' and public.caller_is_active_staff() and lecturer_id = public.app_user_id())
  with check (lecturer_id = public.app_user_id());

drop policy if exists attendance_staff_insert on public.attendance;
create policy attendance_staff_insert on public.attendance for insert to authenticated
  with check (
    public.caller_is_active_staff()
    and exists (
      select 1 from public.attendance_sessions s
       where s.id = attendance.session_id
         and s.lecturer_id = public.app_user_id()
         and s.ended_at is null
    )
  );

drop policy if exists attendance_staff_delete on public.attendance;
create policy attendance_staff_delete on public.attendance for delete to authenticated
  using (
    public.caller_is_active_staff()
    and exists (
      select 1 from public.attendance_sessions s
       where s.id = attendance.session_id
         and s.lecturer_id = public.app_user_id()
         and s.ended_at is null
    )
  );

drop policy if exists verification_logs_staff_insert on public.verification_logs;
create policy verification_logs_staff_insert on public.verification_logs for insert to authenticated
  with check (
    public.app_role() = 'staff'
    and public.caller_is_active_staff()
    and invigilator_id = public.app_user_id()
  );
