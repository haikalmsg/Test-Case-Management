-- Add reusable plans without rewriting legacy executions or their snapshots.
create table public.test_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '' check (length(description) <= 10000),
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, project_id)
);
create table public.plan_cases (
  plan_id uuid not null,
  case_id uuid not null,
  project_id uuid not null,
  primary key(plan_id, case_id),
  foreign key(plan_id, project_id) references public.test_plans(id, project_id),
  foreign key(case_id, project_id) references public.test_cases(id, project_id)
);
alter table public.test_runs
  add column plan_id uuid,
  add column source_run_id uuid,
  add constraint runs_plan_fkey foreign key(plan_id, project_id) references public.test_plans(id, project_id),
  add constraint runs_plan_identity unique(id, plan_id, project_id),
  add constraint runs_source_fkey foreign key(source_run_id, plan_id, project_id) references public.test_runs(id, plan_id, project_id),
  add constraint runs_source_requires_plan check(source_run_id is null or plan_id is not null);
create index plans_project_idx on public.test_plans(project_id, archived_at, created_at desc);
create index plan_cases_case_idx on public.plan_cases(case_id);
create index runs_plan_idx on public.test_runs(plan_id, created_at desc);
create index runs_source_idx on public.test_runs(source_run_id);
alter table public.test_plans enable row level security;
alter table public.plan_cases enable row level security;
-- Supabase installs permissive default table grants; remove them explicitly.
revoke all on public.test_plans, public.plan_cases from public, anon, authenticated;
grant select on public.test_plans, public.plan_cases to authenticated;
create policy plans_read on public.test_plans for select to authenticated using(private.is_member());
create policy plan_cases_read on public.plan_cases for select to authenticated using(private.is_member());

-- Keep the existing snapshot implementation private. New runs must use a plan.
alter function public.create_run(uuid,text,text,uuid[]) set schema private;
revoke execute on function private.create_run(uuid,text,text,uuid[]) from public, anon, authenticated;

create function public.save_plan(p_project_id uuid, p_name text, p_description text, p_case_ids uuid[], p_plan_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_count integer;
begin
  if not private.active_project(p_project_id) then raise exception 'Active team membership and project required'; end if;
  -- Same lock order as save_case: project before plan/case rows. A run takes
  -- a shared project lock so its membership and case snapshots are consistent.
  perform 1 from public.projects where id=p_project_id and archived_at is null for update;
  if not found then raise exception 'Project unavailable'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 160 or p_description is null or length(p_description)>10000 then raise exception 'Invalid plan details'; end if;
  if p_case_ids is null or cardinality(p_case_ids)>1000 or cardinality(p_case_ids)<>(select count(distinct x) from unnest(p_case_ids) x) then raise exception 'Select up to 1000 unique cases'; end if;
  if p_plan_id is null then
    insert into public.test_plans(project_id,name,description,created_by)
    values(p_project_id,trim(p_name),p_description,auth.uid()) returning id into v_id;
  else
    update public.test_plans set name=trim(p_name),description=p_description,updated_at=now()
    where id=p_plan_id and project_id=p_project_id and archived_at is null returning id into v_id;
    if v_id is null then raise exception 'Plan unavailable or archived'; end if;
  end if;
  -- Archived cases may stay in an existing plan, but cannot be newly imported.
  select count(*) into v_count from public.test_cases c
  where c.project_id=p_project_id and c.id=any(p_case_ids)
    and (c.archived_at is null or exists(select 1 from public.plan_cases pc where pc.plan_id=v_id and pc.case_id=c.id));
  if v_count<>cardinality(p_case_ids) then raise exception 'Some selected cases are archived or belong to another project'; end if;
  delete from public.plan_cases where plan_id=v_id and not(case_id=any(p_case_ids));
  insert into public.plan_cases(plan_id,case_id,project_id)
    select v_id,x,p_project_id from unnest(p_case_ids) x on conflict do nothing;
  return v_id;
end; $$;

create function public.archive_plan(p_plan_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_project uuid;
begin
  select project_id into v_project from public.test_plans where id=p_plan_id;
  if not private.active_project(v_project) then raise exception 'Active team membership and project required'; end if;
  perform 1 from public.projects where id=v_project and archived_at is null for update;
  if not found then raise exception 'Project unavailable'; end if;
  update public.test_plans set archived_at=now(),updated_at=now() where id=p_plan_id and archived_at is null;
  if not found then raise exception 'Plan unavailable or archived'; end if;
end; $$;

create function public.create_plan_run(p_plan_id uuid, p_name text, p_environment text, p_source_run_id uuid default null, p_mode text default 'all')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_project uuid; v_plan public.test_plans; v_source public.test_runs; v_ids uuid[]; v_run uuid;
begin
  select project_id into v_project from public.test_plans where id=p_plan_id;
  if not private.active_project(v_project) then raise exception 'Active team membership and project required'; end if;
  perform 1 from public.projects where id=v_project and archived_at is null for share;
  if not found then raise exception 'Project unavailable'; end if;
  select * into v_plan from public.test_plans where id=p_plan_id and archived_at is null for share;
  if v_plan.id is null then raise exception 'Plan unavailable or archived'; end if;
  if p_mode is null or p_mode not in ('all','unsuccessful') then raise exception 'Invalid rerun mode'; end if;
  if p_source_run_id is not null then
    select * into v_source from public.test_runs where id=p_source_run_id and plan_id=p_plan_id and project_id=v_project for share;
    if v_source.id is null or v_source.status<>'completed' then raise exception 'Reruns require a completed run from this plan'; end if;
  elsif p_mode='unsuccessful' then
    raise exception 'Select a completed run to rerun failed/blocked cases';
  end if;
  select coalesce(array_agg(c.id order by c.number),'{}'::uuid[]) into v_ids
  from public.plan_cases pc join public.test_cases c on c.id=pc.case_id
  where pc.plan_id=p_plan_id and c.archived_at is null
    and (p_mode='all' or exists(select 1 from public.run_cases rc where rc.run_id=p_source_run_id and rc.case_id=c.id and rc.status in ('failed','blocked')));
  if cardinality(v_ids)=0 then raise exception 'No eligible cases remain to execute'; end if;
  v_run:=private.create_run(v_project,p_name,p_environment,v_ids);
  update public.test_runs set plan_id=p_plan_id,source_run_id=p_source_run_id where id=v_run;
  return v_run;
end; $$;
revoke execute on function public.save_plan(uuid,text,text,uuid[],uuid), public.archive_plan(uuid), public.create_plan_run(uuid,text,text,uuid,text) from public,anon;
grant execute on function public.save_plan(uuid,text,text,uuid[],uuid), public.archive_plan(uuid), public.create_plan_run(uuid,text,text,uuid,text) to authenticated;
