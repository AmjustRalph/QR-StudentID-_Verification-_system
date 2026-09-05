-- =============================================================================
-- QR-SIDVS · 0007_invigilator_sets_exam_venue.sql
-- Moves "which classroom, morning or evening" from admin-at-scheduling-time to
-- invigilator-at-verification-time for examinations — the invigilator is the
-- one actually in the room, same reasoning already applied to attendance
-- sessions (0006_session_period_and_venue.sql), where the lecturer sets it.
--
-- venue was `not null` from spec §3; it has to become nullable so admin can
-- schedule an exam before a room is assigned, and the invigilator fills it in
-- via a setup step mirroring Attendance Scanning's.
--
-- Staff get a narrow UPDATE policy plus a guard trigger restricting them to
-- exactly venue/session_period — same pattern as guard_student_columns and
-- guard_user_status. Admin and service_role are exempt, matching those.
--
-- Run after 0006_session_period_and_venue.sql. Idempotent: safe to re-run.
-- =============================================================================

alter table public.examinations alter column venue drop not null;

drop policy if exists examinations_staff_update on public.examinations;
create policy examinations_staff_update on public.examinations for update to authenticated
  using (public.app_role() = 'staff')
  with check (public.app_role() = 'staff');

create or replace function public.guard_examination_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.course_id is distinct from old.course_id
     or new.exam_date is distinct from old.exam_date
     or new.exam_time is distinct from old.exam_time
     or new.semester is distinct from old.semester
     or new.eligibility_criteria is distinct from old.eligibility_criteria then
    raise exception 'Staff may only set venue and session_period on an examination';
  end if;

  return new;
end;
$$;

drop trigger if exists examinations_guard_columns on public.examinations;
create trigger examinations_guard_columns
  before update on public.examinations
  for each row execute function public.guard_examination_columns();
