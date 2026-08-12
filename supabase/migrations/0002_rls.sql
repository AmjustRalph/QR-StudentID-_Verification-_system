-- =============================================================================
-- QR-SIDVS · 0002_rls.sql
-- Row Level Security per QR-SIDVS-Build-Spec_2.md §3:
--   · Students — read/write only their own rows.
--   · Staff    — read scoped to their assigned courses; write to attendance,
--                attendance_sessions and verification_logs for their sessions.
--   · Admin    — full read/write.
-- Run after 0001_schema.sql. Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers.
--
-- All SECURITY DEFINER, which is what stops the classic RLS recursion: a policy
-- on public.users that had to SELECT public.users to evaluate itself would
-- never terminate. These read the table with RLS bypassed instead.
-- ---------------------------------------------------------------------------
create or replace function public.app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from public.users where auth_user_id = auth.uid() $$;

create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$ select role from public.users where auth_user_id = auth.uid() $$;

create or replace function public.app_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from public.students where auth_user_id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$ select public.app_role() = 'admin' $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$ select public.app_role() in ('staff', 'admin') $$;

-- True when the signed-in staff member lectures the given course.
create or replace function public.teaches_course(target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courses c
     where c.id = target_course
       and c.lecturer_id = public.app_user_id()
  );
$$;

-- True when the given student is enrolled in any course the signed-in staff
-- member lectures. This is the boundary for "read access scoped to courses
-- they're assigned to" (spec §3).
create or replace function public.can_see_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
     where e.student_id = target_student
       and c.lecturer_id = public.app_user_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- Column guard: a student may edit their own contact details, but must not be
-- able to rotate their qr_seed, reassign their student ID, or reactivate a
-- deactivated account. RLS grants row access, not column access — so this
-- trigger enforces the column boundary.
-- ---------------------------------------------------------------------------
create or replace function public.guard_student_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
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

drop trigger if exists students_guard_columns on public.students;
create trigger students_guard_columns
  before update on public.students
  for each row execute function public.guard_student_columns();

-- ---------------------------------------------------------------------------
-- Flag guard: a lecturer must be able to update their own session — that is how
-- ending it and recording the headcount works — but resolving the discrepancy
-- flag is the admin's call alone (spec §4.5). Without this, the person whose
-- headcount raised the flag could also clear it.
-- ---------------------------------------------------------------------------
create or replace function public.guard_session_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The scanned_count sync trigger updates this row as a side effect of an
  -- attendance insert. That path is trusted; a direct client write is not.
  if coalesce(current_setting('app.internal_count_sync', true), 'off') = 'on' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.discrepancy_resolved is distinct from old.discrepancy_resolved
     or new.resolved_by is distinct from old.resolved_by
     or new.resolved_at is distinct from old.resolved_at then
    raise exception 'Only an administrator may resolve a flagged session';
  end if;

  -- scanned_count is maintained by the attendance trigger, not by clients.
  if new.scanned_count is distinct from old.scanned_count then
    raise exception 'scanned_count is derived from attendance rows and cannot be set directly';
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_sessions_guard_resolution on public.attendance_sessions;
create trigger attendance_sessions_guard_resolution
  before update on public.attendance_sessions
  for each row execute function public.guard_session_resolution();

-- The headcount check itself: closing a session with a reported headcount that
-- disagrees with the scanned count raises the flag automatically. Soft check —
-- it never blocks the close, it just records the mismatch (spec §4.3).
create or replace function public.flag_headcount_discrepancy()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is not null and new.reported_headcount is not null then
    new.discrepancy_flag := new.reported_headcount is distinct from new.scanned_count;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_sessions_flag_headcount on public.attendance_sessions;
create trigger attendance_sessions_flag_headcount
  before update on public.attendance_sessions
  for each row execute function public.flag_headcount_discrepancy();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. Default-deny is the point: any table left without a
-- matching policy is unreachable from the browser.
-- ---------------------------------------------------------------------------
alter table public.users                enable row level security;
alter table public.students             enable row level security;
alter table public.student_secrets      enable row level security;
alter table public.courses              enable row level security;
alter table public.enrollments          enable row level security;
alter table public.attendance_sessions  enable row level security;
alter table public.attendance           enable row level security;
alter table public.examinations         enable row level security;
alter table public.exam_registrations   enable row level security;
alter table public.verification_logs    enable row level security;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update to authenticated
  using (auth_user_id = auth.uid())
  -- Role is never self-assignable: it must survive the update unchanged.
  with check (auth_user_id = auth.uid() and role = public.app_role());

drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
drop policy if exists students_select on public.students;
create policy students_select on public.students for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.is_admin()
    or (public.app_role() = 'staff' and public.can_see_student(id))
  );

drop policy if exists students_update_self on public.students;
create policy students_update_self on public.students for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists students_admin_all on public.students;
create policy students_admin_all on public.students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses — readable by everyone signed in (course names appear on student
-- timetables and staff dashboards alike); writable only by admin.
-- ---------------------------------------------------------------------------
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using (true);

drop policy if exists courses_admin_all on public.courses;
create policy courses_admin_all on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to authenticated
  using (
    student_id = public.app_student_id()
    or public.is_admin()
    or (public.app_role() = 'staff' and public.teaches_course(course_id))
  );

drop policy if exists enrollments_admin_all on public.enrollments;
create policy enrollments_admin_all on public.enrollments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- attendance_sessions
-- ---------------------------------------------------------------------------
drop policy if exists attendance_sessions_select on public.attendance_sessions;
create policy attendance_sessions_select on public.attendance_sessions for select to authenticated
  using (
    public.is_admin()
    or lecturer_id = public.app_user_id()
    or (public.app_role() = 'staff' and public.teaches_course(course_id))
    or exists (
      select 1 from public.enrollments e
       where e.course_id = attendance_sessions.course_id
         and e.student_id = public.app_student_id()
    )
  );

drop policy if exists attendance_sessions_staff_insert on public.attendance_sessions;
create policy attendance_sessions_staff_insert on public.attendance_sessions for insert to authenticated
  with check (
    public.app_role() = 'staff'
    and lecturer_id = public.app_user_id()
    and public.teaches_course(course_id)
  );

drop policy if exists attendance_sessions_staff_update on public.attendance_sessions;
create policy attendance_sessions_staff_update on public.attendance_sessions for update to authenticated
  using (public.app_role() = 'staff' and lecturer_id = public.app_user_id())
  with check (lecturer_id = public.app_user_id());

drop policy if exists attendance_sessions_admin_all on public.attendance_sessions;
create policy attendance_sessions_admin_all on public.attendance_sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
  using (
    student_id = public.app_student_id()
    or public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
       where s.id = attendance.session_id
         and s.lecturer_id = public.app_user_id()
    )
  );

-- Only the lecturer running the session may mark anyone present, and only while
-- that session is still open. Students can never write their own attendance.
drop policy if exists attendance_staff_insert on public.attendance;
create policy attendance_staff_insert on public.attendance for insert to authenticated
  with check (
    exists (
      select 1 from public.attendance_sessions s
       where s.id = attendance.session_id
         and s.lecturer_id = public.app_user_id()
         and s.ended_at is null
    )
  );

drop policy if exists attendance_staff_delete on public.attendance;
create policy attendance_staff_delete on public.attendance for delete to authenticated
  using (
    exists (
      select 1 from public.attendance_sessions s
       where s.id = attendance.session_id
         and s.lecturer_id = public.app_user_id()
         and s.ended_at is null
    )
  );

drop policy if exists attendance_admin_all on public.attendance;
create policy attendance_admin_all on public.attendance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- examinations — timetable is readable by all signed-in users.
-- ---------------------------------------------------------------------------
drop policy if exists examinations_select on public.examinations;
create policy examinations_select on public.examinations for select to authenticated
  using (true);

drop policy if exists examinations_admin_all on public.examinations;
create policy examinations_admin_all on public.examinations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- exam_registrations — a student sees only their own; staff need to read them
-- to run eligibility checks (b) and (c) at the hall door; only admin writes.
-- ---------------------------------------------------------------------------
drop policy if exists exam_registrations_select on public.exam_registrations;
create policy exam_registrations_select on public.exam_registrations for select to authenticated
  using (student_id = public.app_student_id() or public.is_staff());

drop policy if exists exam_registrations_admin_all on public.exam_registrations;
create policy exam_registrations_admin_all on public.exam_registrations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- verification_logs — append-only from the invigilator's device. Nobody but an
-- admin may amend or delete a log entry once written; it is the audit trail.
-- ---------------------------------------------------------------------------
drop policy if exists verification_logs_select on public.verification_logs;
create policy verification_logs_select on public.verification_logs for select to authenticated
  using (
    student_id = public.app_student_id()
    or invigilator_id = public.app_user_id()
    or public.is_admin()
  );

drop policy if exists verification_logs_staff_insert on public.verification_logs;
create policy verification_logs_staff_insert on public.verification_logs for insert to authenticated
  with check (public.app_role() = 'staff' and invigilator_id = public.app_user_id());

drop policy if exists verification_logs_admin_all on public.verification_logs;
create policy verification_logs_admin_all on public.verification_logs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- student_secrets — intentionally NO policy. RLS is on and nothing matches, so
-- the table is unreachable from the browser under every role including admin.
-- The rotating code is minted server-side from the seed, in an Edge Function
-- holding the service_role key, which bypasses RLS entirely.
--
-- The belt-and-braces revoke below means a misconfiguration later — someone
-- adding a permissive policy by accident — still doesn't expose the seed.
-- ---------------------------------------------------------------------------
revoke all on public.student_secrets from authenticated, anon;
