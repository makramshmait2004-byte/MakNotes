-- Cross-user isolation test. Run with a privileged connection (SQL editor / management API).
-- Creates two throw-away users, impersonates each one, and asserts neither can read or modify
-- the other's rows. Everything runs in a transaction that is rolled back.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@maknotes.test', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@maknotes.test', '', now(), now(), now(), '{}', '{}');

create temporary table results (name text, passed boolean) on commit drop;
grant all on results to authenticated, anon;

-- ===== act as user A =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into public.journal_entries (id, entry_date, title) values ('10000000-0000-4000-8000-000000000001', '2026-11-25', 'A secret');
insert into public.drawings (id, kind) values ('20000000-0000-4000-8000-000000000001', 'sketch');
insert into public.drawing_strokes (drawing_id, tool, color, width, points) values ('20000000-0000-4000-8000-000000000001', 'pen', '#000000', 2, '[0,0,0.5,1,1,0.5]');
insert into public.tasks (id, title) values ('30000000-0000-4000-8000-000000000001', 'A task');
insert into public.daily_pages (date) values ('2026-11-25');

insert into results select 'A sees own profile (signup trigger)', count(*) = 1 from public.profiles;
insert into results select 'A sees own settings with Beirut default', (select timezone = 'Asia/Beirut' from public.user_settings);
insert into results select 'A sees own journal', count(*) = 1 from public.journal_entries;

-- ===== act as user B =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

insert into results select 'B cannot read A journal', count(*) = 0 from public.journal_entries;
insert into results select 'B cannot read A strokes', count(*) = 0 from public.drawing_strokes;
insert into results select 'B cannot read A tasks', count(*) = 0 from public.tasks;
insert into results select 'B sees only own profile', count(*) = 1 from public.profiles;

with u as (update public.journal_entries set title = 'hacked' where id = '10000000-0000-4000-8000-000000000001' returning 1)
insert into results select 'B cannot update A journal', count(*) = 0 from u;
with d as (delete from public.tasks where id = '30000000-0000-4000-8000-000000000001' returning 1)
insert into results select 'B cannot delete A task', count(*) = 0 from d;

-- B cannot insert a row claiming to be A
do $$ begin
  begin
    insert into public.tasks (user_id, title) values ('00000000-0000-4000-8000-00000000000a', 'spoof');
    insert into results values ('B cannot insert as A', false);
  exception when others then
    insert into results values ('B cannot insert as A', true);
  end;
end $$;

-- B cannot attach a child row to A's parent (composite FK + RLS)
do $$ begin
  begin
    insert into public.drawing_strokes (drawing_id, tool, color, width, points) values ('20000000-0000-4000-8000-000000000001', 'pen', '#000000', 2, '[]');
    insert into results values ('B cannot add stroke to A drawing', false);
  exception when others then
    insert into results values ('B cannot add stroke to A drawing', true);
  end;
end $$;

-- B's own daily page for the same date is allowed (uniqueness is per user)
insert into public.daily_pages (date) values ('2026-11-25');
insert into results select 'B has own page for same date', count(*) = 1 from public.daily_pages;

-- duplicate daily page for same user is rejected
do $$ begin
  begin
    insert into public.daily_pages (date) values ('2026-11-25');
    insert into results values ('Duplicate daily page rejected', false);
  exception when unique_violation then
    insert into results values ('Duplicate daily page rejected', true);
  end;
end $$;

-- ===== anonymous =====
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin
    perform count(*) from public.journal_entries;
    insert into results values ('anon cannot read journal', false);
  exception when insufficient_privilege then
    insert into results values ('anon cannot read journal', true);
  end;
end $$;

reset role;
select name, passed from results order by passed, name;
rollback;
