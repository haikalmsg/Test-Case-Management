create schema if not exists private;
create type public.member_role as enum ('admin','member');
create type public.case_priority as enum ('low','medium','high','critical');
create type public.case_classification as enum ('manual','automated');
create type public.result_status as enum ('untested','passed','failed','blocked','skipped');
create type public.run_status as enum ('active','completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, full_name text not null default '', created_at timestamptz not null default now()
);
create table public.memberships (
  user_id uuid primary key references public.profiles(id),
  role public.member_role not null default 'member', active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(), email text not null unique check (email = lower(trim(email))),
  role public.member_role not null default 'member', invited_by uuid not null references public.profiles(id),
  accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.workspace_settings (
  id boolean primary key default true check(id), name text not null default 'Test Case Management' check(length(trim(name)) between 1 and 100)
);
insert into public.workspace_settings(id) values(true);
create table public.projects (
  id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name text not null check(length(trim(name)) between 1 and 120), description text not null default '',
  archived_at timestamptz, next_case_number integer not null default 1,
  created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now()
);
create table public.suites (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  name text not null check(length(trim(name)) between 1 and 120), description text not null default '',
  archived_at timestamptz, created_at timestamptz not null default now(), unique(id,project_id)
);
create table public.test_cases (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  suite_id uuid, number integer not null, title text not null check(length(trim(title)) between 1 and 200),
  description text not null default '', preconditions text not null default '',
  priority public.case_priority not null default 'medium', classification public.case_classification not null default 'manual',
  archived_at timestamptz, created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,project_id), unique(project_id,number), foreign key(suite_id,project_id) references public.suites(id,project_id)
);
create table public.case_steps (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.test_cases(id) on delete cascade,
  position integer not null check(position >= 0), action text not null check(length(trim(action)) > 0),
  expected_result text not null check(length(trim(expected_result)) > 0), unique(case_id,position)
);
create table public.test_runs (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  name text not null check(length(trim(name)) between 1 and 160), environment text not null default '',
  status public.run_status not null default 'active', created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), completed_at timestamptz, unique(id,project_id)
);
create table public.run_cases (
  id uuid primary key default gen_random_uuid(), run_id uuid not null, project_id uuid not null, case_id uuid not null,
  case_number integer not null, snapshot jsonb not null, status public.result_status not null default 'untested',
  notes text not null default '', tester_id uuid references public.profiles(id), tested_at timestamptz,
  unique(run_id,case_id), foreign key(run_id,project_id) references public.test_runs(id,project_id),
  foreign key(case_id,project_id) references public.test_cases(id,project_id)
);
create index suites_project_idx on public.suites(project_id);
create index cases_project_idx on public.test_cases(project_id,archived_at,number);
create index steps_case_idx on public.case_steps(case_id);
create index runs_project_idx on public.test_runs(project_id,created_at desc);
create index run_cases_run_idx on public.run_cases(run_id);

create function private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where user_id = (select auth.uid()) and active);
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where user_id = (select auth.uid()) and active and role='admin');
$$;
create function private.active_project(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_member() and exists(select 1 from public.projects where id=p_id and archived_at is null);
$$;
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_member(), private.is_admin(), private.active_project(uuid) from public;
grant execute on function private.is_member(), private.is_admin(), private.active_project(uuid) to authenticated;

create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,email,full_name) values(new.id,lower(new.email),coalesce(new.raw_user_meta_data->>'full_name',''));
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.create_profile();
create function private.protect_last_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(791240);
 if old.active and old.role='admin' and (tg_op='DELETE' or not new.active or new.role <> 'admin') then
  if not exists(select 1 from public.memberships where active and role='admin' and user_id <> old.user_id) then
   raise exception 'The last admin cannot be removed or demoted';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
create trigger protect_last_admin before update or delete on public.memberships for each row execute function private.protect_last_admin();
create function private.number_case() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 update public.projects set next_case_number=next_case_number+1 where id=new.project_id and archived_at is null returning next_case_number-1 into new.number;
 if new.number is null then raise exception 'Project is archived or unavailable'; end if;
 return new;
end; $$;
create trigger number_case before insert on public.test_cases for each row execute function private.number_case();
create function private.protect_case_identity() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.project_id<>old.project_id or new.number<>old.number or new.created_by<>old.created_by then raise exception 'Case identity cannot be changed'; end if;
 new.updated_at=now(); return new;
end; $$;
create trigger protect_case_identity before update on public.test_cases for each row execute function private.protect_case_identity();

alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.projects enable row level security;
alter table public.suites enable row level security;
alter table public.test_cases enable row level security;
alter table public.case_steps enable row level security;
alter table public.test_runs enable row level security;
alter table public.run_cases enable row level security;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles,public.memberships,public.invitations,public.workspace_settings,public.projects,public.suites,public.test_cases,public.case_steps,public.test_runs,public.run_cases to authenticated;
grant insert on public.projects,public.suites to authenticated;
grant update(name,description,archived_at) on public.projects,public.suites to authenticated;
grant update(name) on public.workspace_settings to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(private.is_member() or id=(select auth.uid()));
create policy memberships_read on public.memberships for select to authenticated using(private.is_member() or user_id=(select auth.uid()));
create policy invitations_read on public.invitations for select to authenticated using(private.is_admin());
create policy settings_read on public.workspace_settings for select to authenticated using(private.is_member());
create policy settings_update on public.workspace_settings for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy projects_read on public.projects for select to authenticated using(private.is_member());
create policy projects_insert on public.projects for insert to authenticated with check(private.is_admin() and created_by=(select auth.uid()));
create policy projects_update on public.projects for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy suites_read on public.suites for select to authenticated using(private.is_member());
create policy suites_insert on public.suites for insert to authenticated with check(private.active_project(project_id));
create policy suites_update on public.suites for update to authenticated using(private.active_project(project_id)) with check(private.active_project(project_id));
create policy cases_read on public.test_cases for select to authenticated using(private.is_member());
create policy steps_read on public.case_steps for select to authenticated using(private.is_member());
create policy runs_read on public.test_runs for select to authenticated using(private.is_member());
create policy results_read on public.run_cases for select to authenticated using(private.is_member());

-- Mutating RPCs verify membership and preserve transaction-level invariants.
create function public.save_case(p_project_id uuid,p_title text,p_description text,p_preconditions text,p_priority public.case_priority,p_classification public.case_classification,p_steps jsonb,p_suite_id uuid default null,p_case_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_step jsonb; v_position integer := 0;
begin
 if not private.active_project(p_project_id) then raise exception 'Active team membership and project required'; end if;
 perform 1 from public.projects where id=p_project_id and archived_at is null for update;
 if not found then raise exception 'Project unavailable'; end if;
 if p_suite_id is not null then
  perform 1 from public.suites where id=p_suite_id and project_id=p_project_id and archived_at is null for share;
  if not found then raise exception 'Suite is unavailable or belongs to another project'; end if;
 end if;
 if length(trim(p_title)) not between 1 and 200 or length(p_description)>10000 or length(p_preconditions)>10000 then raise exception 'Invalid case content'; end if;
 if p_steps is null or jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps)>100 then raise exception 'Invalid steps'; end if;
 if p_case_id is null then
  insert into public.test_cases(project_id,suite_id,title,description,preconditions,priority,classification,created_by)
   values(p_project_id,p_suite_id,trim(p_title),p_description,p_preconditions,p_priority,p_classification,auth.uid()) returning id into v_id;
 else
  update public.test_cases set suite_id=p_suite_id,title=trim(p_title),description=p_description,preconditions=p_preconditions,priority=p_priority,classification=p_classification
   where id=p_case_id and project_id=p_project_id and archived_at is null returning id into v_id;
  if v_id is null then raise exception 'Case unavailable'; end if;
  delete from public.case_steps where case_id=v_id;
 end if;
 for v_step in select * from jsonb_array_elements(p_steps) loop
  if coalesce(length(trim(v_step->>'action')),0) not between 1 and 5000 or coalesce(length(trim(v_step->>'expected_result')),0) not between 1 and 5000 then raise exception 'Each step needs an action and expected result'; end if;
  insert into public.case_steps(case_id,position,action,expected_result) values(v_id,v_position,v_step->>'action',v_step->>'expected_result');
  v_position:=v_position+1;
 end loop;
 return v_id;
end; $$;
create function public.archive_case(p_case_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_project uuid;
begin
 select project_id into v_project from public.test_cases where id=p_case_id;
 if not private.active_project(v_project) then raise exception 'Active team membership and project required'; end if;
 perform 1 from public.projects where id=v_project and archived_at is null for share;
 if not found then raise exception 'Project unavailable'; end if;
 update public.test_cases set archived_at=now() where id=p_case_id;
end; $$;
create function public.create_run(p_project_id uuid,p_name text,p_environment text,p_case_ids uuid[]) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_run uuid; v_case public.test_cases; v_snapshot jsonb; v_count integer:=0;
begin
 if not private.active_project(p_project_id) then raise exception 'Active team membership and project required'; end if;
 perform 1 from public.projects where id=p_project_id and archived_at is null for share;
 if not found then raise exception 'Project unavailable'; end if;
 if cardinality(p_case_ids) is null or cardinality(p_case_ids) not between 1 and 1000 or cardinality(p_case_ids)<>(select count(distinct x) from unnest(p_case_ids) x) then raise exception 'Select 1–1000 unique cases'; end if;
 if length(trim(p_name)) not between 1 and 160 or length(p_environment)>200 then raise exception 'Invalid run details'; end if;
 insert into public.test_runs(project_id,name,environment,created_by) values(p_project_id,trim(p_name),p_environment,auth.uid()) returning id into v_run;
 for v_case in select * from public.test_cases where project_id=p_project_id and archived_at is null and id=any(p_case_ids) order by number for share loop
  -- Locking case rows coordinates with save_case, which updates before replacing steps.
  v_snapshot:=jsonb_build_object('title',v_case.title,'description',v_case.description,'preconditions',v_case.preconditions,'priority',v_case.priority,'classification',v_case.classification,
   'suite_name',(select name from public.suites where id=v_case.suite_id),
   'steps',coalesce((select jsonb_agg(jsonb_build_object('action',action,'expected_result',expected_result) order by position) from public.case_steps where case_id=v_case.id),'[]'::jsonb));
  insert into public.run_cases(run_id,project_id,case_id,case_number,snapshot) values(v_run,p_project_id,v_case.id,v_case.number,v_snapshot);
  v_count:=v_count+1;
 end loop;
 if v_count<>cardinality(p_case_ids) then raise exception 'Some selected cases are archived or belong to another project'; end if;
 return v_run;
end; $$;
create function public.record_result(p_run_case_id uuid,p_status public.result_status,p_notes text) returns void language plpgsql security definer set search_path = '' as $$
declare v_run public.test_runs;
begin
 if not private.is_member() then raise exception 'Active team membership required'; end if;
 select r.* into v_run from public.test_runs r join public.run_cases c on c.run_id=r.id where c.id=p_run_case_id for update of r;
 if v_run.id is null or v_run.status='completed' then raise exception 'Run unavailable or completed'; end if;
 if not private.active_project(v_run.project_id) then raise exception 'Project is archived'; end if;
 perform 1 from public.projects where id=v_run.project_id and archived_at is null for share;
 if not found then raise exception 'Project is archived'; end if;
 if length(p_notes)>10000 or p_status is null then raise exception 'Invalid result'; end if;
 update public.run_cases set status=p_status,notes=p_notes,tester_id=case when p_status='untested' then null else auth.uid() end,tested_at=case when p_status='untested' then null else now() end where id=p_run_case_id;
end; $$;
create function public.complete_run(p_run_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_run public.test_runs;
begin
 if not private.is_member() then raise exception 'Active team membership required'; end if;
 select * into v_run from public.test_runs where id=p_run_id for update;
 if v_run.id is null or v_run.status='completed' then raise exception 'Run unavailable or completed'; end if;
 if not private.active_project(v_run.project_id) then raise exception 'Project is archived'; end if;
 perform 1 from public.projects where id=v_run.project_id and archived_at is null for share;
 if not found then raise exception 'Project is archived'; end if;
 if not exists(select 1 from public.run_cases where run_id=p_run_id) or exists(select 1 from public.run_cases where run_id=p_run_id and status='untested') then raise exception 'Record a result for every case before completing'; end if;
 update public.test_runs set status='completed',completed_at=now() where id=p_run_id;
end; $$;
create function public.manage_member(p_user_id uuid,p_role public.member_role,p_active boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(791240);
 if not private.is_admin() then raise exception 'Admin required'; end if;
 update public.memberships set role=p_role,active=p_active where user_id=p_user_id;
 if not found then raise exception 'Member unavailable'; end if;
end; $$;
create function public.prepare_invitation(p_email text,p_role public.member_role) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not private.is_admin() then raise exception 'Admin required'; end if;
 if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Invalid email'; end if;
 if exists(select 1 from public.memberships m join public.profiles p on p.id=m.user_id where p.email=lower(trim(p_email)) and m.active) then raise exception 'User is already an active member'; end if;
 insert into public.invitations(email,role,invited_by) values(lower(trim(p_email)),p_role,auth.uid())
 on conflict(email) do update set role=excluded.role,invited_by=excluded.invited_by,accepted_at=null,revoked_at=null,created_at=now() returning id into v_id;
 return v_id;
end; $$;
create function public.revoke_invitation(p_invitation_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'Admin required'; end if;
 update public.invitations set revoked_at=now() where id=p_invitation_id and accepted_at is null;
end; $$;
create function public.accept_invitation() returns void language plpgsql security definer set search_path = '' as $$
declare v_email text; v_inv public.invitations;
begin
 perform pg_advisory_xact_lock(791240);
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Verified email required'; end if;
 select * into v_inv from public.invitations where email=v_email and accepted_at is null and revoked_at is null and created_at>now()-interval '7 days' for update;
 if v_inv.id is null then raise exception 'No valid invitation found'; end if;
 insert into public.memberships(user_id,role,active) values(auth.uid(),v_inv.role,true)
 on conflict(user_id) do update set role=excluded.role,active=true;
 update public.invitations set accepted_at=now() where id=v_inv.id;
end; $$;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.save_case(uuid,text,text,text,public.case_priority,public.case_classification,jsonb,uuid,uuid),public.archive_case(uuid),public.create_run(uuid,text,text,uuid[]),public.record_result(uuid,public.result_status,text),public.complete_run(uuid),public.manage_member(uuid,public.member_role,boolean),public.prepare_invitation(text,public.member_role),public.revoke_invitation(uuid),public.accept_invitation() to authenticated;
revoke execute on function private.create_profile(),private.protect_last_admin(),private.number_case(),private.protect_case_identity() from public,anon,authenticated;
