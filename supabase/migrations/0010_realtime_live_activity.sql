-- =============================================================================
-- QR-SIDVS · 0010_realtime_live_activity.sql
-- Adds `attendance` and `verification_logs` to the supabase_realtime
-- publication so the Admin Dashboard's Live Activity feed can subscribe to
-- new rows as they're inserted, instead of only refreshing on page load.
--
-- RLS still governs what a subscriber actually receives — the existing
-- SELECT policies on both tables already grant admins full read access via
-- public.is_admin() (see 0002_rls.sql), so no policy changes are needed here.
--
-- Run after 0009_lecturer_quizzes.sql. Idempotent: safe to re-run.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'verification_logs'
  ) then
    alter publication supabase_realtime add table public.verification_logs;
  end if;
end $$;
