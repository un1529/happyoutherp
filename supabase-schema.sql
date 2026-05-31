-- 행복한교회 청년회 ERP: 공용 저장 MVP
-- Supabase Dashboard > SQL Editor에서 한 번 실행합니다.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('accountant', 'executive', 'pastor', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists public.erp_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.profiles enable row level security;
alter table public.erp_state enable row level security;

create or replace function private.is_accountant()
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
      and role = 'accountant'
  );
$$;

revoke all on function private.is_accountant() from public;
grant execute on function private.is_accountant() to authenticated;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or (select private.is_accountant()));

drop policy if exists "profiles_manage_accountant" on public.profiles;
create policy "profiles_manage_accountant"
on public.profiles for all
to authenticated
using ((select private.is_accountant()))
with check ((select private.is_accountant()));

drop policy if exists "erp_state_read_authenticated" on public.erp_state;
create policy "erp_state_read_authenticated"
on public.erp_state for select
to authenticated
using (true);

drop policy if exists "erp_state_insert_accountant" on public.erp_state;
create policy "erp_state_insert_accountant"
on public.erp_state for insert
to authenticated
with check ((select private.is_accountant()));

drop policy if exists "erp_state_update_accountant" on public.erp_state;
create policy "erp_state_update_accountant"
on public.erp_state for update
to authenticated
using ((select private.is_accountant()))
with check ((select private.is_accountant()));

-- Authentication > Users에서 사용자를 만든 다음, 실제 UUID로 교체해서 실행합니다.
-- 회계담당 예시:
-- insert into public.profiles (id, display_name, role)
-- values ('사용자-UUID', '회계담당', 'accountant');
