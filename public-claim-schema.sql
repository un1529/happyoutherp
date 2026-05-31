-- 행복한교회 청년회 ERP: 로그인 없는 공개 청구 접수
-- Supabase Dashboard > SQL Editor에서 한 번 실행합니다.
-- 실행 후 Authentication > Providers > Anonymous Sign-Ins를 활성화합니다.

create schema if not exists private;

create or replace function private.can_monitor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('accountant', 'monitor')
  );
$$;

revoke all on function private.can_monitor() from public;
grant execute on function private.can_monitor() to authenticated;

-- 익명 로그인도 authenticated 역할을 사용하므로 내부 ERP 읽기는 등록된 임원 계정으로 제한합니다.
drop policy if exists "erp_state_read_authenticated" on public.erp_state;
drop policy if exists "erp_state_read_monitor" on public.erp_state;
create policy "erp_state_read_monitor"
on public.erp_state for select
to authenticated
using ((select private.can_monitor()));

create table if not exists public.public_claims (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  requester_name text not null check (char_length(requester_name) between 1 and 40),
  affiliation text check (affiliation is null or char_length(affiliation) <= 60),
  contact text check (contact is null or char_length(contact) <= 40),
  track text not null check (track in ('선지출', '선승인')),
  used_at date not null,
  amount bigint not null check (amount > 0),
  vendor text not null check (char_length(vendor) between 1 and 100),
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_claims enable row level security;

revoke all on table public.public_claims from anon;
grant insert, select, update on table public.public_claims to authenticated;

drop policy if exists "public_claims_submit_anonymous" on public.public_claims;
create policy "public_claims_submit_anonymous"
on public.public_claims for insert
to authenticated
with check (
  (select auth.uid()) = submitted_by
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
);

drop policy if exists "public_claims_read_monitor" on public.public_claims;
create policy "public_claims_read_monitor"
on public.public_claims for select
to authenticated
using ((select private.can_monitor()));

drop policy if exists "public_claims_update_accountant" on public.public_claims;
create policy "public_claims_update_accountant"
on public.public_claims for update
to authenticated
using ((select private.is_accountant()))
with check ((select private.is_accountant()));
