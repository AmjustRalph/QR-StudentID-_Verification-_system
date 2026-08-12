# QR-SIDVS — Build Specification

**Project:** QR Student ID Verification System
**Institution:** Ghana Communication Technology University (GCTU)
**Stack:** React + TypeScript + Tailwind CSS (frontend) · Supabase (Postgres, Auth, Edge Functions, RLS)
**Scope:** Final year academic project — built for a demo/test cohort, not full institutional scale.

This document is the single source of truth for the build. Hand this to Claude Code at the start of each session for context.

---

## 1. Supabase Credentials

- **Project URL:** `https://zrpqirockgeyxwtyxsop.supabase.co`
- **Publishable (anon) key:** stored in `.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — never commit `.env` to Git.
- **Secret/service_role key:** used only in Edge Functions (server-side), never in frontend code or Git.

---

## 2. User Roles & Account Creation

Two account-creation paths only:

| Role | How the account is created |
|---|---|
| **Student** | Public self-signup (Sign-Up screen): institutional email, student ID, programme, level, password |
| **Staff** (Lecturer / Invigilator) | Created only by an Administrator, via the Staff Accounts screen — sends a Supabase Auth invite email |
| **Administrator** | First admin created manually via a one-time seed script (see §6) — no signup path exists |

- Invigilators are not a separate role — they use the **Staff** role and the same scanning interface, just pointed at exam sessions instead of lecture sessions.
- Login screen has a role selector for routing convenience, but the actual role enforced comes from the database (`users.role`), never from user input.

---

## 3. Database Schema (Postgres via Supabase)

Core tables:

- **`students`** — id (uuid, PK), auth_user_id (FK), full_name, student_id_number, programme, level, email, qr_seed (unique string root used to derive both static card code and rotating digital code), photo_url, status (active/deactivated)
- **`users`** — id (uuid, PK), auth_user_id (FK), full_name, email, role (`student` | `staff` | `admin`), created_at
- **`courses`** — id, code, name, lecturer_id (FK → users)
- **`enrollments`** — student_id (FK), course_id (FK) — many-to-many
- **`attendance_sessions`** — id, course_id (FK), lecturer_id (FK), started_at, ended_at, scanned_count, reported_headcount, discrepancy_flag (bool), discrepancy_resolved (bool)
- **`attendance`** — id, session_id (FK), student_id (FK), scanned_at, scan_source (`physical_card` | `digital_display` | `manual`), status (`present`)
- **`examinations`** — id, course_id (FK), exam_date, exam_time, venue, semester, eligibility_criteria
- **`verification_logs`** — id, student_id (FK), examination_id (FK), invigilator_id (FK), verified_at, outcome (`granted` | `denied`), denial_reason (nullable)

Row Level Security (RLS):
- Students: read/write only their own rows across `students`, `attendance`, `verification_logs`.
- Staff: read access scoped to courses they're assigned to; write access to `attendance`, `attendance_sessions`, `verification_logs` for their own sessions.
- Admin: full read/write across all tables.

---

## 4. Key Behavioral Decisions (from design discussion)

1. **Rotating digital QR code** — the Student Dashboard shows a QR code that regenerates every 30–60 seconds (short-lived signed token derived from `qr_seed` + timestamp), distinct from the permanent static code embedded in the physical PVC card. Prevents screenshot-sharing of the phone version. A note on the dashboard states: *"For classroom use only. Physical card required for examinations."*

2. **Photo-glance confirmation** — every scan (attendance and exam verification) displays the student's photo, name, and ID on the scanning device immediately, so the lecturer/invigilator can visually confirm the person matches the card, regardless of which code type was scanned.

3. **End-of-session headcount check** — when a lecturer ends an attendance session, they enter an **actual headcount**. If it doesn't match `scanned_count`, the session is flagged (`discrepancy_flag = true`) for admin review. This is a soft check (doesn't block ending the session), logged for later reporting.

4. **Manual fallback** — if a student has neither card nor phone, staff can search and mark them present manually from the scanning screen. Logged with `scan_source = 'manual'` so it's distinguishable in reports/audits.

5. **Flag resolution** — admin can mark a flagged session as resolved (`discrepancy_resolved = true`) from the Reports screen (filtered view), rather than a separate dedicated screen.

6. **Exam eligibility check** — three sequential checks per scan: (a) QR code validity, (b) exam registration status, (c) administrative clearance. All three must pass for `outcome = 'granted'`; otherwise `denied` with a specific `denial_reason`.

---

## 5. Screens to Build (14 total)

| # | Screen | Role |
|---|--------|------|
| 1 | Sign-Up | Student |
| 2 | Login (role-routed) | All |
| 3 | Forgot Password | All |
| 4 | Student Dashboard (rotating QR) | Student |
| 5 | Attendance History | Student |
| 6 | Examination Schedule | Student |
| 7 | Student Profile | Student |
| 8 | Lecturer/Staff Dashboard | Staff |
| 9 | Attendance Scanning (photo-glance + headcount) | Staff |
| 10 | Examination Verification (3-check + photo-glance) | Staff |
| 11 | Administrator Dashboard | Admin |
| 12 | Student Management | Admin |
| 13 | Staff Accounts | Admin |
| 14 | Reports (incl. flagged-session review) | Admin |

---

## 6. Day 1 Build Order

1. Scaffold React + TypeScript + Tailwind project; connect to Supabase using credentials in §1.
2. Create schema + RLS policies from §3 (via Supabase SQL editor or migration files).
3. Write and run a **seed script** to create the first Administrator account directly (bypassing the normal signup flow) — this is the one manual bootstrap step.
4. Build auth flow: student signup, login with role-based redirect.
5. Confirm end-to-end: sign up a test student, log in, see an empty dashboard talking live to Supabase.

From there, proceed screen by screen per the two-week plan already agreed (student side → lecturer/scanning side → exam verification → admin side → integration/testing).

---

## 7. Visual Design Reference

Mockups already produced for screens 2, 4, 9, 10, 11, 14 (see `QR-SIDVS-Mockups/` folder) — use as the visual reference for color palette, typography, and the corner-bracket "scan reticle" motif used throughout.

**Instruction for Claude Code:** place the PNG files from `QR-SIDVS-Mockups/` into a `design-reference/` folder at the project root before starting UI work. These mockups are a **style guide, not a literal spec to clone** — match the palette, typography, layout patterns, and the corner-bracket "scan reticle" motif, but build real, responsive, stateful components rather than reproducing the flat images pixel-for-pixel. Screens not covered by a mockup (Sign-Up, Forgot Password, Attendance History, Examination Schedule, Student Profile, Lecturer Dashboard, Student Management, Staff Accounts) should extend the same design system consistently.

- Primary navy: `#10203D` / `#1B3968`
- Accent azure (actions, active states): `#2F6FED`
- Verified/success green: `#0E9C6B`
- Denied/error red: `#D93B3B`
- Pending/amber: `#C88A1E`
- Background: `#F3F6FC`
- Display font: Poppins · Body: DejaVu Sans / system sans · Data/mono (IDs, timestamps, codes): DejaVu Sans Mono

Replace placeholder GCTU mark and colors with official branding assets if/when available.
Interface.png
    ├── Figure 4.4 - Examination Verification Interface.png
    ├── Figure 4.5 - Administrator Dashboard.png
    └── Figure 4.6 - Reports Screen.png
---

## 8. Open Items to Confirm Before or During Build

- Exact GCTU brand colors/logo, if different from the placeholder above.
- Real course list for seed data.
- Test cohort (names/IDs) for UAT.
