-- =============================================================================
-- QR-SIDVS · 0008_lecturer_profile_visible.sql
-- Fixes a gap found while building the student "My Courses" screen: courses
-- are readable by everyone (courses_select using(true)), but a lecturer's
-- name lives on public.users, which only the admin or the user themselves
-- could read (users_select). Embedding course:courses(lecturer:users(...))
-- as a student silently returned lecturer: null — the row was invisible, not
-- missing.
--
-- Adds one narrow additional SELECT policy: any authenticated user may read a
-- users row that is the lecturer of at least one course. Nothing confidential
-- is exposed by this — if you can already see the course (everyone can),
-- seeing who teaches it is not a meaningfully bigger disclosure. This does
-- NOT expose staff/admin accounts that aren't lecturing anything, and RLS
-- policies for SELECT are OR'd together, so the existing self/admin policy
-- is unchanged.
--
-- Run after 0007_invigilator_sets_exam_venue.sql. Idempotent: safe to re-run.
-- =============================================================================

drop policy if exists users_select_lecturers on public.users;
create policy users_select_lecturers on public.users for select to authenticated
  using (
    exists (select 1 from public.courses c where c.lecturer_id = users.id)
  );
