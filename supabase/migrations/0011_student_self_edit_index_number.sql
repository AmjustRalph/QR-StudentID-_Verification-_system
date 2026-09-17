-- =============================================================================
-- QR-SIDVS · 0011_student_self_edit_index_number.sql
-- Lets a student correct their own index number — several early sign-ups
-- used a placeholder GCTU/XX/NNNN format before the real 10-digit format was
-- known, and only an administrator could fix it until now. status, level and
-- programme stay admin-only, unchanged from guard_student_columns before.
--
-- A student can still only set a properly-formed 10-digit value; anything
-- else raises, same defense-in-depth pattern as the other guard triggers.
--
-- Run after 0010_realtime_live_activity.sql. Idempotent: safe to re-run.
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

  if new.status is distinct from old.status
     or new.level is distinct from old.level
     or new.programme is distinct from old.programme then
    raise exception 'Only an administrator may change status, level or programme';
  end if;

  if new.student_id_number is distinct from old.student_id_number
     and new.student_id_number !~ '^[0-9]{10}$' then
    raise exception 'Index number must be exactly 10 digits';
  end if;

  return new;
end;
$$;
