-- =============================================================================
-- QR-SIDVS · 0001_schema.sql
-- Core schema per QR-SIDVS-Build-Spec_2.md §3.
-- Run in the Supabase SQL editor (or `supabase db push`) before 0002_rls.sql.
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'staff', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'student_status') then
    create type public.student_status as enum ('active', 'deactivated');
  end if;

  if not exists (select 1 from pg_type where typname = 'scan_source') then
    create type public.scan_source as enum ('physical_card', 'digital_display', 'manual');
  end if;

  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present');
  end if;

  if not exists (select 1 from pg_type where typname = 'verification_outcome') then
    create type public.verification_outcome as enum ('granted', 'denied');
  end if;

  if not exists (select 1 from pg_type where typname = 'clearance_status') then
    create type public.clearance_status as enum ('cleared', 'pending_fees', 'blocked');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- 64 hex chars of entropy, used as the root secret for a student's codes.
-- Deliberately avoids pgcrypto so the migration has no extension prerequisite.
create or replace function public.generate_qr_seed()
returns text
language sql
volatile
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — one row per authenticated principal, whatever the role.
-- `role` here is the ONLY authority on what a person may do. The role selector
-- on the login screen is routing convenience only (spec §2).
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name    text not null,
  email        text not null unique,
  role         public.user_role not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists users_role_idx on public.users (role);

-- ---------------------------------------------------------------------------
-- students — the academic record. One-to-one with a `users` row of role
-- 'student', but kept separate so student data can be managed independently.
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid not null unique references auth.users (id) on delete cascade,
  full_name          text not null,
  student_id_number  text not null unique,
  programme          text,
  level              int check (level between 100 and 900),
  email              text not null unique,
  photo_url          text,
  status             public.student_status not null default 'active',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists students_status_idx on public.students (status);
create index if not exists students_student_id_number_idx on public.students (student_id_number);

-- ---------------------------------------------------------------------------
-- student_secrets — the root secret from which BOTH codes are derived: the
-- permanent code printed on the PVC card, and the 30–60s rotating code on the
-- phone (spec §4.1).
--
-- Deliberately a separate table rather than a `students.qr_seed` column. RLS
-- grants access per row, not per column, so a column on `students` would either
-- leak the seed to anyone allowed to read the row, or force every query in the
-- app to enumerate columns instead of `select *`. Isolating it here means the
-- table simply has RLS on and no policy at all — unreachable from the browser
-- under any role, reachable only by service_role inside an Edge Function.
-- ---------------------------------------------------------------------------
create table if not exists public.student_secrets (
  student_id uuid primary key references public.students (id) on delete cascade,
  qr_seed    text not null unique default public.generate_qr_seed(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- courses / enrollments
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  lecturer_id uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists courses_lecturer_idx on public.courses (lecturer_id);

create table if not exists public.enrollments (
  student_id uuid not null references public.students (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

create index if not exists enrollments_course_idx on public.enrollments (course_id);

-- ---------------------------------------------------------------------------
-- attendance_sessions / attendance
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_sessions (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references public.courses (id) on delete cascade,
  lecturer_id          uuid not null references public.users (id) on delete restrict,
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  scanned_count        int not null default 0,
  reported_headcount   int,
  discrepancy_flag     boolean not null default false,
  discrepancy_resolved boolean not null default false,
  resolved_by          uuid references public.users (id) on delete set null,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists attendance_sessions_course_idx on public.attendance_sessions (course_id);
create index if not exists attendance_sessions_lecturer_idx on public.attendance_sessions (lecturer_id);
create index if not exists attendance_sessions_flag_idx
  on public.attendance_sessions (discrepancy_flag)
  where discrepancy_flag;

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  scan_source public.scan_source not null,
  status      public.attendance_status not null default 'present',
  -- A student can only be marked present once per session; a second scan is a
  -- no-op rather than a duplicate row.
  unique (session_id, student_id)
);

create index if not exists attendance_student_idx on public.attendance (student_id);
create index if not exists attendance_session_idx on public.attendance (session_id);

-- Keep attendance_sessions.scanned_count in step with the attendance rows, so
-- the headcount comparison (spec §4.3) can never drift from reality.
create or replace function public.sync_scanned_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Marks the UPDATE below as system-generated, so guard_session_resolution
  -- (0002_rls.sql) lets the derived count through while still refusing a direct
  -- write from a client. Transaction-local, so it cannot leak between requests.
  perform set_config('app.internal_count_sync', 'on', true);

  if tg_op = 'INSERT' then
    update public.attendance_sessions
       set scanned_count = scanned_count + 1
     where id = new.session_id;
  else
    update public.attendance_sessions
       set scanned_count = greatest(scanned_count - 1, 0)
     where id = old.session_id;
  end if;

  perform set_config('app.internal_count_sync', 'off', true);

  if tg_op = 'INSERT' then
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists attendance_sync_count on public.attendance;
create trigger attendance_sync_count
  after insert or delete on public.attendance
  for each row execute function public.sync_scanned_count();

-- ---------------------------------------------------------------------------
-- examinations / exam_registrations / verification_logs
-- ---------------------------------------------------------------------------
create table if not exists public.examinations (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references public.courses (id) on delete cascade,
  exam_date            date not null,
  exam_time            time not null,
  venue                text not null,
  semester             text,
  eligibility_criteria text,
  created_at           timestamptz not null default now()
);

create index if not exists examinations_course_idx on public.examinations (course_id);
create index if not exists examinations_date_idx on public.examinations (exam_date);

-- NOTE: not in spec §3, but required to implement the three-check eligibility
-- rule in §4.6 — check (b) registration and check (c) clearance both need a
-- per-student, per-exam record. Also backs the CLEARED / PENDING FEES badges
-- on the Student Dashboard (Figure 4.2).
create table if not exists public.exam_registrations (
  id               uuid primary key default gen_random_uuid(),
  examination_id   uuid not null references public.examinations (id) on delete cascade,
  student_id       uuid not null references public.students (id) on delete cascade,
  is_registered    boolean not null default true,
  clearance_status public.clearance_status not null default 'pending_fees',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (examination_id, student_id)
);

create index if not exists exam_registrations_student_idx on public.exam_registrations (student_id);

create table if not exists public.verification_logs (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid references public.students (id) on delete set null,
  examination_id uuid not null references public.examinations (id) on delete cascade,
  invigilator_id uuid not null references public.users (id) on delete restrict,
  verified_at    timestamptz not null default now(),
  outcome        public.verification_outcome not null,
  denial_reason  text,
  -- A denial must say why; a grant must not carry a reason.
  constraint verification_logs_reason_matches_outcome check (
    (outcome = 'denied' and denial_reason is not null) or
    (outcome = 'granted' and denial_reason is null)
  )
);

create index if not exists verification_logs_exam_idx on public.verification_logs (examination_id);
create index if not exists verification_logs_student_idx on public.verification_logs (student_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();

drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students
  for each row execute function public.touch_updated_at();

drop trigger if exists exam_registrations_touch on public.exam_registrations;
create trigger exam_registrations_touch before update on public.exam_registrations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Provisioning: every auth.users row gets a matching public.users row, and
-- students additionally get a public.students row with a fresh qr_seed.
--
-- Role and academic details travel in raw_user_meta_data, set by:
--   · the Sign-Up screen  (role forced to 'student' — see the guard below)
--   · the admin invite    (role 'staff')
--   · scripts/seed-admin  (role 'admin', service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  claimed_role  text  := meta ->> 'role';
  resolved_role public.user_role;
  full_name     text  := coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1));
  new_student   uuid;
begin
  -- Anything unrecognised — including a self-signup that tries to claim
  -- 'admin' — lands on 'student'. Privilege can only be granted server-side.
  resolved_role := case
    when claimed_role in ('student', 'staff', 'admin') then claimed_role::public.user_role
    else 'student'::public.user_role
  end;

  insert into public.users (auth_user_id, full_name, email, role)
  values (new.id, full_name, new.email, resolved_role)
  on conflict (auth_user_id) do nothing;

  if resolved_role = 'student' then
    insert into public.students (
      auth_user_id, full_name, student_id_number, programme, level, email
    )
    values (
      new.id,
      full_name,
      coalesce(nullif(trim(meta ->> 'student_id_number'), ''), 'PENDING-' || left(new.id::text, 8)),
      nullif(trim(meta ->> 'programme'), ''),
      nullif(meta ->> 'level', '')::int,
      new.email
    )
    on conflict (auth_user_id) do nothing
    returning id into new_student;

    -- `returning` yields nothing when the insert hit the conflict clause, so
    -- fall back to a lookup before minting the seed.
    if new_student is null then
      select id into new_student from public.students where auth_user_id = new.id;
    end if;

    insert into public.student_secrets (student_id)
    values (new_student)
    on conflict (student_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
