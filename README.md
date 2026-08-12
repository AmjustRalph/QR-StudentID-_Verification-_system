# QR-SIDVS

QR Student ID Verification System — Ghana Communication Technology University.
Final year project. React + TypeScript + Tailwind on Supabase.

The build specification in [QR-SIDVS-Build-Spec_2.md](QR-SIDVS-Build-Spec_2.md) is the source of
truth; this README covers only how to get it running.

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

Fill in `.env`. The publishable (anon) key and the service_role key are both under
**Supabase → Project Settings → API**. `.env` is gitignored and must stay that way — the
service_role key bypasses every RLS policy in the project.

### 2. Apply the migrations

In the Supabase SQL editor, run in order:

1. `supabase/migrations/0001_schema.sql` — tables, enums, triggers
2. `supabase/migrations/0002_rls.sql` — RLS policies and identity helpers
3. `supabase/migrations/0003_storage.sql` — the `student-photos` bucket and its access policies

All three are idempotent, so re-running them is safe.

### 3. Create the first administrator

There is no admin signup path by design (spec §2), so the first one is seeded out of band:

```bash
npm run seed:admin
```

Then sign in, change the password, and delete `SEED_ADMIN_PASSWORD` from `.env`.

### 4. Run

```bash
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run typecheck
```

---

## Verifying the Day 1 slice

1. Open `/signup`, register a student with a `@gctu.edu.gh` address and an ID like `GCTU/22/0148`.
2. Confirm in Supabase that the trigger created three rows: one in `users` (role `student`),
   one in `students`, one in `student_secrets`.
3. Sign in at `/login`. You should land on `/student` with a populated header and empty
   attendance / examination cards — those are live queries against Supabase returning nothing yet.
4. Sign in as the seeded admin. You should land on `/admin` with live counts.

**If signup appears to hang on "check your inbox":** email confirmation is on by default and GCTU
addresses you don't control will never receive it. For a demo cohort, turn off
**Authentication → Providers → Email → Confirm email** in the Supabase dashboard.

---

## How this is laid out

```
src/
  components/ui/       Design-system primitives (Button, Field, Card, StatusPill, Reticle …)
  components/layout/   AppShell (navy rail + top bar), AuthLayout (split hero)
  features/auth/       AuthProvider, route guards, signup validation
  features/student/    Student record hook, verification code panel
  pages/               One file per screen, grouped by role
  lib/                 Supabase client, DB types, formatting, helpers
supabase/migrations/   Schema and RLS, applied in numeric order
scripts/seed-admin.ts  One-time administrator bootstrap
design-reference/      The six mockups the design system is derived from
```

### Design system

All colour, type and elevation tokens live in one `@theme` block in
[src/styles/index.css](src/styles/index.css) — no raw hex anywhere else. The corner-bracket
scan reticle is [`<Reticle>`](src/components/ui/Reticle.tsx) and should frame anything
representing a code being presented or read.

### Two things worth knowing about the schema

**`student_secrets` is a separate table.** Spec §3 puts `qr_seed` on `students`, but RLS grants
access per row, not per column — so a seed column would be readable by anyone allowed to read the
student row. It lives in its own table with RLS enabled and *no policy at all*, which makes it
unreachable from the browser under every role including admin. Only an Edge Function holding the
service_role key can read it to mint the rotating code.

**`exam_registrations` is an addition to spec §3.** The three-check eligibility rule in §4.6 needs
per-student, per-exam records for check (b) registration and check (c) clearance, and §3 defines no
table to hold them. It also backs the CLEARED / PENDING FEES badges in Figure 4.2.

---

## Status

All 14 screens from spec §5 are built and live against Supabase — auth, all three role dashboards,
both scanning screens (backed by real signed QR codes minted/verified through Edge Functions), and
every admin management screen (Student Management, Staff Accounts, Examinations, Attendance
Records, Reports).

Known gaps, not bugs:

- **Deploying the frontend.** Only the Supabase backend (database, Edge Functions) is deployed. The
  React app itself has only ever run via `npm run dev` — invite/reset-password emails link back to
  `localhost`, which only works on the machine running the dev server. Deploying to Vercel, Netlify,
  or similar is the natural next step before this is usable from more than one device.
- **Report PDF export** uses the browser's native print-to-PDF rather than a generated PDF file —
  functional, no extra dependency, but not a one-click download the way CSV export is.
