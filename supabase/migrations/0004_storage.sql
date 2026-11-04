-- =====================================================================
-- AMONGHER · 0004 · Secure file storage
-- Only one bucket exists: private evidence for "verified contributor"
-- requests. It is NOT public; objects are readable only by the member who
-- uploaded them and by admins (via short-lived signed URLs).
-- Avatars are generated motifs, so no profile photos are ever stored.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-evidence', 'verification-evidence', false, 5242880,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Objects must live under "<uid>/..." so folder ownership is enforceable in the policy.
create policy "evidence: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-evidence'
              and (storage.foldername(name))[1] = auth.uid()::text
              and private.account_is_active(auth.uid()));

create policy "evidence: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'verification-evidence'
         and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));

create policy "evidence: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
