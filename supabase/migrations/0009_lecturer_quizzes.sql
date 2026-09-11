-- =============================================================================
-- QR-SIDVS · 0009_lecturer_quizzes.sql
-- Lets a lecturer schedule their own lightweight Quiz/Test for a course they
-- teach, without going through admin — distinct from a formal Examination,
-- which stays admin-only and keeps the full registration+clearance flow.
--
-- `kind` defaults to 'exam' so every existing row (and every admin-scheduled
-- one going forward) is unaffected. Only 'quiz'/'test' rows may be created by
-- staff, and only for a course they teach (public.teaches_course, already
-- defined in 0002_rls.sql).
--
-- Run after 0008_lecturer_profile_visible.sql. Idempotent: safe to re-run.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'examination_kind') then
    create type public.examination_kind as enum ('exam', 'quiz', 'test');
  end if;
end $$;

alter table public.examinations
  add column if not exists kind public.examination_kind not null default 'exam';

drop policy if exists examinations_staff_insert on public.examinations;
create policy examinations_staff_insert on public.examinations for insert to authenticated
  with check (
    public.app_role() = 'staff'
    and kind in ('quiz', 'test')
    and public.teaches_course(course_id)
  );
