-- =============================================================================
-- QR-SIDVS · 0006_session_period_and_venue.sql
-- Adds a classroom/venue name and a morning/evening session period to
-- attendance sessions, and a session period to examinations (which already
-- had `venue` from spec §3). Both are nullable — existing rows are left as-is,
-- and the UI collects them going forward when starting a session or
-- scheduling an exam.
-- Run after 0005_guard_service_role.sql. Idempotent: safe to re-run.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'session_period') then
    create type public.session_period as enum ('morning', 'evening');
  end if;
end $$;

alter table public.attendance_sessions
  add column if not exists venue text,
  add column if not exists session_period public.session_period;

alter table public.examinations
  add column if not exists session_period public.session_period;
