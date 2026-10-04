create function public.dashboard_summary() returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
 if not private.is_member() then raise exception 'Active team membership required'; end if;
 return jsonb_build_object(
  'projects',(select count(*) from public.projects where archived_at is null),
  'cases',(select count(*) from public.test_cases c join public.projects p on p.id=c.project_id where c.archived_at is null and p.archived_at is null),
  'active_runs',(select count(*) from public.test_runs r join public.projects p on p.id=r.project_id where r.status='active' and p.archived_at is null),
  'results',(select coalesce(jsonb_object_agg(s,n),'{}'::jsonb) from (select status::text s,count(*) n from public.run_cases group by status) q)
 );
end; $$;
revoke execute on function public.dashboard_summary() from public,anon;
grant execute on function public.dashboard_summary() to authenticated;
