-- 행복한교회 청년회 ERP: 로그인 없는 공개 청구 접수
-- Supabase Dashboard > SQL Editor에서 한 번 실행합니다.
create schema if not exists private;
create or replace function private.can_monitor() returns boolean language sql security definer set search_path = public stable as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('accountant', 'monitor')); $$;
revoke all on function private.can_monitor() from public;
grant execute on function private.can_monitor() to authenticated;
drop policy if exists "erp_state_read_authenticated" on public.erp_state;
drop policy if exists "erp_state_read_monitor" on public.erp_state;
create policy "erp_state_read_monitor" on public.erp_state for select to authenticated using ((select private.can_monitor()));
create table if not exists public.public_claims (
  id uuid primary key default gen_random_uuid(), submitted_by uuid references auth.users(id) on delete set null,
  requester_name text not null check (char_length(requester_name) between 1 and 40), affiliation text check (affiliation is null or char_length(affiliation) <= 60), contact text check (contact is null or char_length(contact) <= 40),
  track text not null check (track in ('선지출', '선승인')), used_at date not null, amount bigint not null check (amount > 0), vendor text not null check (char_length(vendor) between 1 and 100), reason text not null check (char_length(reason) between 1 and 500), receipt_path text, receipt_name text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'completed', 'rejected')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.public_claims enable row level security;
revoke all on table public.public_claims from anon;
grant insert, select, update on table public.public_claims to authenticated;
drop policy if exists "public_claims_submit_anonymous" on public.public_claims;
create policy "public_claims_submit_anonymous" on public.public_claims for insert to authenticated with check ((select auth.uid()) = submitted_by and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false));
drop policy if exists "public_claims_read_monitor" on public.public_claims;
create policy "public_claims_read_monitor" on public.public_claims for select to authenticated using ((select private.can_monitor()));
drop policy if exists "public_claims_update_accountant" on public.public_claims;
create policy "public_claims_update_accountant" on public.public_claims for update to authenticated using ((select private.is_accountant())) with check ((select private.is_accountant()));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('claim-receipts', 'claim-receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "claim_receipts_submit_own_folder" on storage.objects;
create policy "claim_receipts_submit_own_folder" on storage.objects for insert to authenticated with check (bucket_id = 'claim-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false));
drop policy if exists "claim_receipts_cleanup_own_folder" on storage.objects;
create policy "claim_receipts_cleanup_own_folder" on storage.objects for delete to authenticated using (bucket_id = 'claim-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false));
drop policy if exists "claim_receipts_read_monitor" on storage.objects;
create policy "claim_receipts_read_monitor" on storage.objects for select to authenticated using (bucket_id = 'claim-receipts' and (select private.can_monitor()));
