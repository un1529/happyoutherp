-- 기존 Supabase 프로젝트에 모니터링 전용 역할을 추가합니다.
-- SQL Editor에서 한 번 실행합니다.

alter table public.profiles
  add column if not exists job_title text;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('accountant', 'monitor'));

-- 기존 회계담당 계정은 accountant 역할을 그대로 유지합니다.
-- monitor 역할은 erp_state 조회만 가능하고 수정할 수 없습니다.
