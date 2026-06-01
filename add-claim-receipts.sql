-- 행복한교회 청년회 ERP: 공개 청구 영수증 업로드 추가
-- Supabase Dashboard > SQL Editor에서 한 번 실행합니다.

alter table public.public_claims
  add column if not exists receipt_path text,
  add column if not exists receipt_name text;

-- 익명 계정을 정리해도 접수 내역은 유지합니다.
alter table public.public_claims
  alter column submitted_by drop not null;

alter table public.public_claims
  drop constraint if exists public_claims_submitted_by_fkey;

alter table public.public_claims
  add constraint public_claims_submitted_by_fkey
  foreign key (submitted_by) references auth.users(id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'claim-receipts',
  'claim-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "claim_receipts_submit_own_folder" on storage.objects;
create policy "claim_receipts_submit_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'claim-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
);

drop policy if exists "claim_receipts_cleanup_own_folder" on storage.objects;
create policy "claim_receipts_cleanup_own_folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'claim-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
);

drop policy if exists "claim_receipts_read_monitor" on storage.objects;
create policy "claim_receipts_read_monitor"
on storage.objects for select
to authenticated
using (
  bucket_id = 'claim-receipts'
  and (select private.can_monitor())
);
