-- Existing suites become root folders in the case library.
alter table public.suites
  add column parent_id uuid,
  add constraint suites_parent_fkey foreign key(parent_id,project_id) references public.suites(id,project_id),
  add constraint suites_not_own_parent check(parent_id is distinct from id);
create index suites_parent_idx on public.suites(parent_id,project_id);

-- Serializing hierarchy edits per project also makes concurrent reparenting safe.
create function private.protect_group_tree() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and (new.id<>old.id or new.project_id<>old.project_id) then raise exception 'Group identity cannot be changed'; end if;
  perform 1 from public.projects where id=new.project_id for update;
  if new.parent_id is not null then
    if exists(
      with recursive ancestors as (
        select id,parent_id from public.suites where id=new.parent_id and project_id=new.project_id
        union all
        select s.id,s.parent_id from public.suites s join ancestors a on s.id=a.parent_id where s.project_id=new.project_id
      ) select 1 from ancestors where id=new.id
    ) then raise exception 'A group cannot be moved into itself or one of its subgroups'; end if;
    if new.archived_at is null and not exists(select 1 from public.suites where id=new.parent_id and project_id=new.project_id and archived_at is null) then
      raise exception 'Parent group is unavailable, archived, or belongs to another project';
    end if;
  end if;
  return new;
end; $$;
create trigger protect_group_tree before insert or update on public.suites for each row execute function private.protect_group_tree();
revoke execute on function private.protect_group_tree() from public,anon,authenticated;

revoke all on public.suites from public,anon,authenticated;
grant select on public.suites to authenticated;

create function public.save_group(p_project_id uuid,p_name text,p_description text,p_parent_id uuid default null,p_group_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.active_project(p_project_id) then raise exception 'Active team membership and project required'; end if;
  perform 1 from public.projects where id=p_project_id and archived_at is null for update;
  if not found then raise exception 'Project unavailable'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 or p_description is null or length(p_description)>10000 then raise exception 'Invalid group details'; end if;
  if p_parent_id is not null and not exists(select 1 from public.suites where id=p_parent_id and project_id=p_project_id and archived_at is null) then
    raise exception 'Parent group is unavailable, archived, or belongs to another project';
  end if;
  if p_group_id is null then
    insert into public.suites(project_id,parent_id,name,description) values(p_project_id,p_parent_id,trim(p_name),p_description) returning id into v_id;
  else
    update public.suites set parent_id=p_parent_id,name=trim(p_name),description=p_description
    where id=p_group_id and project_id=p_project_id and archived_at is null returning id into v_id;
    if v_id is null then raise exception 'Group unavailable or archived'; end if;
  end if;
  return v_id;
end; $$;

create function public.archive_group(p_group_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_project uuid;
begin
  select project_id into v_project from public.suites where id=p_group_id;
  if not private.active_project(v_project) then raise exception 'Active team membership and project required'; end if;
  perform 1 from public.projects where id=v_project and archived_at is null for update;
  if not found then raise exception 'Project unavailable'; end if;
  perform 1 from public.suites where id=p_group_id and archived_at is null;
  if not found then raise exception 'Group unavailable or archived'; end if;
  with recursive descendants as (
    select id from public.suites where id=p_group_id
    union all select s.id from public.suites s join descendants d on s.parent_id=d.id where s.project_id=v_project
  ) update public.suites set archived_at=coalesce(archived_at,now()) where id in(select id from descendants);
end; $$;

-- Resolve complete subtrees in the database, without a browser-side folder limit.
create function public.group_descendant_ids(p_project_id uuid,p_group_id uuid) returns uuid[] language plpgsql security invoker set search_path = '' as $$
declare v_ids uuid[];
begin
  if not private.is_member() then raise exception 'Active team membership required'; end if;
  with recursive descendants as (
    select id from public.suites where id=p_group_id and project_id=p_project_id
    union all select s.id from public.suites s join descendants d on s.parent_id=d.id where s.project_id=p_project_id
  ) select coalesce(array_agg(id),'{}'::uuid[]) into v_ids from descendants;
  return v_ids;
end; $$;
revoke execute on function public.save_group(uuid,text,text,uuid,uuid),public.archive_group(uuid),public.group_descendant_ids(uuid,uuid) from public,anon;
grant execute on function public.save_group(uuid,text,text,uuid,uuid),public.archive_group(uuid),public.group_descendant_ids(uuid,uuid) to authenticated;
