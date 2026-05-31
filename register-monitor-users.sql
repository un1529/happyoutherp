-- 1. Supabase Dashboard > Authentication > Users에서 계정을 먼저 만듭니다.
-- 2. 아래 UUID를 각 사용자의 실제 User UID로 교체합니다.
-- 3. SQL Editor에서 실행합니다.

insert into public.profiles (id, display_name, role, job_title)
values
  ('서기-사용자-UUID', '서기', 'monitor', '서기'),
  ('총무-사용자-UUID', '총무', 'monitor', '총무'),
  ('부회장-사용자-UUID', '부회장', 'monitor', '부회장'),
  ('회장-사용자-UUID', '회장', 'monitor', '회장'),
  ('목사님-사용자-UUID', '목사님', 'monitor', '목사님'),
  ('부장님-사용자-UUID', '부장님', 'monitor', '부장님')
on conflict (id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    job_title = excluded.job_title;
