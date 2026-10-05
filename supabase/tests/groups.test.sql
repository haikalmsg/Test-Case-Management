begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
 ('c0000000-0000-0000-0000-000000000001','group-member@test.local',now()),
 ('c0000000-0000-0000-0000-000000000002','group-outsider@test.local',now());
insert into public.memberships(user_id,role) values('c0000000-0000-0000-0000-000000000001','member');
insert into public.projects(id,code,name,created_by) values
 ('c1000000-0000-0000-0000-000000000001','GROUPTEST','Folder project','c0000000-0000-0000-0000-000000000001'),
 ('c1000000-0000-0000-0000-000000000002','GROUPOTHER','Other project','c0000000-0000-0000-0000-000000000001');
insert into public.suites(id,project_id,name) values
 ('c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','Authentication'),
 ('c2000000-0000-0000-0000-000000000004','c1000000-0000-0000-0000-000000000001','Checkout'),
 ('c2000000-0000-0000-0000-000000000009','c1000000-0000-0000-0000-000000000002','Other folder');
insert into public.suites(id,project_id,parent_id,name) values('c2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001','Sign in');
insert into public.suites(id,project_id,parent_id,name) values('c2000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000002','Errors');
create temp table context(key text primary key,id uuid);
grant all on context to authenticated;

set local role anon;
select throws_like('select * from public.suites','%permission denied%','Anonymous callers cannot browse folders');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Denied','')$$,'%permission denied%','Anonymous callers cannot create folders');
reset role;
select set_config('request.jwt.claim.sub','c0000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select is((select count(*) from public.suites),0::bigint,'Nonmembers cannot browse folders');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Denied','')$$,'%membership%','Nonmembers cannot create folders');
select throws_like($$select public.group_descendant_ids('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001')$$,'%membership%','Nonmembers cannot inspect hierarchy');
select throws_like($$select public.archive_group('c2000000-0000-0000-0000-000000000001')$$,'%membership%','Nonmembers cannot archive folders');
reset role;
select set_config('request.jwt.claim.sub','c0000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select throws_like($$insert into public.suites(project_id,name) values('c1000000-0000-0000-0000-000000000001','Bypass')$$,'%permission denied%','Folder creation requires RPC');
select throws_like($$update public.suites set parent_id=null$$,'%permission denied%','Folder moves require RPC');
select is((select parent_id from public.suites where id='c2000000-0000-0000-0000-000000000001'),null::uuid,'Root folders retain null parents');
select is(cardinality(public.group_descendant_ids('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001')),3,'Parent scope includes children and grandchildren');
select is(cardinality(public.group_descendant_ids('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000002')),2,'Child scope excludes ancestors and sibling folders');
select is(cardinality(public.group_descendant_ids('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000009')),0,'Hierarchy scopes cannot cross projects');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Invalid','', 'c2000000-0000-0000-0000-000000000009')$$,'%another project%','New folders cannot use a parent from another project');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Changed','', 'c2000000-0000-0000-0000-000000000009','c2000000-0000-0000-0000-000000000002')$$,'%another project%','Moves cannot cross projects');
select is((select name from public.suites where id='c2000000-0000-0000-0000-000000000002'),'Sign in','Invalid moves preserve folder metadata');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Changed','', 'c2000000-0000-0000-0000-000000000002','c2000000-0000-0000-0000-000000000002')$$,'%itself%','Folders cannot parent themselves');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Changed','', 'c2000000-0000-0000-0000-000000000003','c2000000-0000-0000-0000-000000000001')$$,'%subgroups%','Moving an ancestor into a descendant is rejected');
select is((select parent_id from public.suites where id='c2000000-0000-0000-0000-000000000001'),null::uuid,'Cycle rejection leaves the original tree intact');
select lives_ok($$select public.save_group('c1000000-0000-0000-0000-000000000001','Errors','Moved', 'c2000000-0000-0000-0000-000000000004','c2000000-0000-0000-0000-000000000003')$$,'Folders can be moved to another branch');
select is(cardinality(public.group_descendant_ids('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001')),2,'Moved folders leave the original subtree');
select lives_ok($$select public.save_group('c1000000-0000-0000-0000-000000000001','Errors','', 'c2000000-0000-0000-0000-000000000002','c2000000-0000-0000-0000-000000000003')$$,'Folders can move back to their previous branch');
insert into context select 'leaf',public.save_group('c1000000-0000-0000-0000-000000000001','Network','', 'c2000000-0000-0000-0000-000000000003');
select is(cardinality(public.group_descendant_ids('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001')),4,'Folders can nest beyond two levels');
select lives_ok($$select public.save_group('c1000000-0000-0000-0000-000000000001','Checkout renamed','', null,'c2000000-0000-0000-0000-000000000004')$$,'Root folders can be renamed');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','','')$$,'%Invalid group%','Empty folder names are rejected');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Valid',repeat('x',10001))$$,'%Invalid group%','Oversize descriptions are rejected');

insert into context select 'case',public.save_case('c1000000-0000-0000-0000-000000000001','Nested case','','','medium','manual','[]','c2000000-0000-0000-0000-000000000003');
insert into context select 'plan',public.save_plan('c1000000-0000-0000-0000-000000000001','Nested coverage','',array[(select id from context where key='case')]);
insert into context select 'run',public.create_plan_run((select id from context where key='plan'),'Before archival','');
select is((select snapshot->>'suite_name' from public.run_cases where run_id=(select id from context where key='run')),'Errors','Executions retain their original folder snapshot');
select lives_ok($$select public.archive_group('c2000000-0000-0000-0000-000000000002')$$,'A folder and its subtree can be archived');
select is((select count(*) from public.suites where id=any(public.group_descendant_ids('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000002')) and archived_at is not null),3::bigint,'Archiving reaches every descendant');
select ok((select archived_at is null from public.suites where id='c2000000-0000-0000-0000-000000000001'),'Archiving a subtree leaves its ancestor active');
select ok((select archived_at is null from public.suites where id='c2000000-0000-0000-0000-000000000004'),'Archiving leaves sibling folders active');
select ok((select archived_at is null from public.test_cases where id=(select id from context where key='case')),'Folder archival preserves active library cases');
select is((select suite_id from public.test_cases where id=(select id from context where key='case')),'c2000000-0000-0000-0000-000000000003'::uuid,'Folder archival preserves case identity and placement');
select is((select count(*) from public.plan_cases where plan_id=(select id from context where key='plan')),1::bigint,'Folder archival preserves plan references');
select lives_ok($$select public.create_plan_run((select id from context where key='plan'),'After folder archival','')$$,'Existing plan coverage remains executable after folder archival');
select is((select snapshot->>'suite_name' from public.run_cases where run_id=(select id from context where key='run')),'Errors','Folder changes leave old snapshots unchanged');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Denied','', 'c2000000-0000-0000-0000-000000000002')$$,'%archived%','New folders cannot be created inside archived folders');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Denied','', 'c2000000-0000-0000-0000-000000000002','c2000000-0000-0000-0000-000000000004')$$,'%archived%','Active folders cannot move into archived folders');
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Denied','', null,'c2000000-0000-0000-0000-000000000003')$$,'%archived%','Archived folders cannot be edited');
reset role;
select throws_like($$update public.suites set parent_id='c2000000-0000-0000-0000-000000000001' where id='c2000000-0000-0000-0000-000000000001'$$,'%itself%','Hierarchy guards also protect privileged direct writes');
select throws_like($$update public.suites set parent_id='c2000000-0000-0000-0000-000000000009' where id='c2000000-0000-0000-0000-000000000001'$$,'%another project%','Privileged writes cannot create cross-project parent links');
update public.projects set archived_at=now() where id='c1000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_like($$select public.save_group('c1000000-0000-0000-0000-000000000001','Denied','')$$,'%membership%','Archived projects reject folder creation');
select throws_like($$select public.archive_group('c2000000-0000-0000-0000-000000000001')$$,'%membership%','Archived projects reject folder archival');
reset role;
update public.memberships set active=false where user_id='c0000000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select count(*) from public.suites),0::bigint,'Removed members lose access to the folder tree');
select * from finish();
rollback;
