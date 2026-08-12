-- =============================================================================
-- QR-SIDVS · 0003_storage.sql
-- Storage bucket for student profile photos, uploaded from Student Profile
-- (self-service) and manageable by admin. Public-read bucket: photos exist for
-- photo-glance confirmation during scans (spec §4.2), which is already a
-- semi-public visual check, so a signed-URL scheme adds complexity without a
-- matching security need at this project's scale.
--
-- Object path convention: <student_id>/<filename> — the policies below key off
-- the first path segment to scope writes to the owning student, reusing the
-- same app_student_id()/is_admin() helpers 0002_rls.sql defines for the table
-- policies, so the identity logic lives in exactly one place.
--
-- Run after 0001_schema.sql / 0002_rls.sql. Idempotent: safe to re-run.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists student_photos_select on storage.objects;
create policy student_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'student-photos');

drop policy if exists student_photos_owner_insert on storage.objects;
create policy student_photos_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and (
      (storage.foldername(name))[1] = public.app_student_id()::text
      or public.is_admin()
    )
  );

drop policy if exists student_photos_owner_update on storage.objects;
create policy student_photos_owner_update on storage.objects for update to authenticated
  using (
    bucket_id = 'student-photos'
    and (
      (storage.foldername(name))[1] = public.app_student_id()::text
      or public.is_admin()
    )
  );

drop policy if exists student_photos_owner_delete on storage.objects;
create policy student_photos_owner_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-photos'
    and (
      (storage.foldername(name))[1] = public.app_student_id()::text
      or public.is_admin()
    )
  );
