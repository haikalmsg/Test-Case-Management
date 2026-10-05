begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
 ('a0000000-0000-0000-0000-000000000001','plan-member@test.local',now()),
 ('a0000000-0000-0000-0000-000000000002','plan-outsider@test.local',now());
insert into public.memberships(user_id,role) values('a0000000-0000-0000-0000-000000000001','member');
insert into public.projects(id,code,name,created_by) values
 ('a1000000-0000-0000-0000-000000000001','PLANTEST','Plan project','a0000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002','PLANOTHER','Other project','a0000000-0000-0000-0000-000000000001');
insert into public.suites(id,project_id,name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Authentication');
insert into public.test_cases(id,project_id,suite_id,title,created_by) values
 ('a3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Original case','a0000000-0000-0000-0000-000000000001'),
 ('a3000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Blocked case','a0000000-0000-0000-0000-000000000001'),
 ('a3000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001',null,'Passed case','a0000000-0000-0000-0000-000000000001'),
 ('a3000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000001',null,'Skipped case','a0000000-0000-0000-0000-000000000001'),
 ('a3000000-0000-0000-0000-000000000099','a1000000-0000-0000-0000-000000000002',null,'Other project case','a0000000-0000-0000-0000-000000000001');
insert into public.case_steps(case_id,position,action,expected_result) values('a3000000-0000-0000-0000-000000000001',0,'Original action','Original expected');
create temp table context(key text primary key,id uuid);
grant all on context to authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
-- A legacy execution still has no plan and retains the exact existing format.
insert into context select 'legacy',private.create_run('a1000000-0000-0000-0000-000000000001','Legacy run','',array['a3000000-0000-0000-0000-000000000001'::uuid]);
insert into public.test_plans(id,project_id,name,created_by) values
 ('a4000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Smoke','a0000000-0000-0000-0000-000000000001'),
 ('a4000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001','Regression','a0000000-0000-0000-0000-000000000001'),
 ('a4000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000002','Other plan','a0000000-0000-0000-0000-000000000001');

set local role anon;
select throws_like('select * from public.test_plans','%permission denied%','Anonymous callers cannot read plans');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Denied','',array[]::uuid[])$$,'%permission denied%','Anonymous callers cannot save plans');
reset role;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select is((select count(*) from public.test_plans),0::bigint,'Nonmembers cannot read plans');
select is((select count(*) from public.plan_cases),0::bigint,'Nonmembers cannot read plan membership');
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000001','Denied','')$$,'%membership%','Nonmembers cannot execute plans');
select throws_like($$select public.archive_plan('a4000000-0000-0000-0000-000000000001')$$,'%membership%','Nonmembers cannot archive plans');
reset role;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select throws_like($$select private.create_run('a1000000-0000-0000-0000-000000000001','Bypass','',array['a3000000-0000-0000-0000-000000000001'::uuid])$$,'%permission denied%','Standalone run creation is inaccessible to members');
select throws_like($$update public.test_plans set name='Bypass'$$,'%permission denied%','Plans can only be mutated through RPCs');
select throws_like($$insert into public.plan_cases(plan_id,case_id,project_id) values('a4000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001')$$,'%permission denied%','Membership can only be changed atomically through RPCs');
select lives_ok($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Smoke','Draft',array[]::uuid[],'a4000000-0000-0000-0000-000000000001')$$,'Empty draft plans can be saved');
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000001','Empty','')$$,'%eligible cases%','Empty drafts cannot run');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Invalid','',array['a3000000-0000-0000-0000-000000000001'::uuid,'a3000000-0000-0000-0000-000000000001'::uuid])$$,'%unique cases%','Duplicate cases are rejected');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Invalid','',array[null::uuid])$$,'%unique cases%','Null case IDs are rejected');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Invalid','',null)$$,'%unique cases%','Null case selections are rejected');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Invalid','',array(select gen_random_uuid() from generate_series(1,1001)))$$,'%1000%','Selections exceeding 1000 cases are rejected');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Changed','',array['a3000000-0000-0000-0000-000000000099'::uuid],'a4000000-0000-0000-0000-000000000001')$$,'%another project%','Cross-project imports are rejected');
select is((select name from public.test_plans where id='a4000000-0000-0000-0000-000000000001'),'Smoke','Invalid selection rolls back metadata edits');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Wrong project','',array[]::uuid[],'a4000000-0000-0000-0000-000000000003')$$,'%unavailable%','Plans cannot be moved between projects');
select lives_ok($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Smoke','Coverage',array(select id from public.test_cases where project_id='a1000000-0000-0000-0000-000000000001' order by number),'a4000000-0000-0000-0000-000000000001')$$,'All selected grouped and ungrouped cases can be imported');
select lives_ok($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Regression','',array['a3000000-0000-0000-0000-000000000001'::uuid],'a4000000-0000-0000-0000-000000000002')$$,'A case can be reused in another plan');
select is((select count(*) from public.plan_cases where case_id='a3000000-0000-0000-0000-000000000001'),2::bigint,'Reuse creates references, not copies');
insert into context select 'run',public.create_plan_run('a4000000-0000-0000-0000-000000000001','First execution','Staging');
select is((select count(*) from public.run_cases where run_id=(select id from context where key='run')),4::bigint,'Run includes all current active plan cases');
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000001','Invalid','',null,'bogus')$$,'%mode%','Invalid run modes are rejected');
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000001','Invalid','',null,'unsuccessful')$$,'%completed run%','Targeted reruns require a source');
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000001','Invalid','',(select id from context where key='run'))$$,'%completed run%','Active runs cannot be used as rerun sources');
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000001','Invalid','',(select id from context where key='legacy'))$$,'%completed run%','Legacy executions cannot be rerun as another plan');
select public.record_result(id,case case_number when 1 then 'failed'::public.result_status when 2 then 'blocked'::public.result_status when 3 then 'passed'::public.result_status else 'skipped'::public.result_status end,'Original notes') from public.run_cases where run_id=(select id from context where key='run');
select public.complete_run((select id from context where key='run'));
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000002','Invalid','',(select id from context where key='run'))$$,'%this plan%','Rerun sources must belong to the selected plan');
select public.save_case('a1000000-0000-0000-0000-000000000001','Updated case','','','high','manual','[{"action":"Updated action","expected_result":"Updated expected"}]','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001');
insert into context select 'retry',public.create_plan_run('a4000000-0000-0000-0000-000000000001','Retry','Staging',(select id from context where key='run'),'unsuccessful');
select is((select count(*) from public.run_cases where run_id=(select id from context where key='retry')),2::bigint,'Only failed and blocked cases are rerun');
select is((select snapshot->>'title' from public.run_cases where run_id=(select id from context where key='retry') and case_number=1),'Updated case','Reruns snapshot the latest definition');
select is((select snapshot->'steps'->0->>'action' from public.run_cases where run_id=(select id from context where key='retry') and case_number=1),'Updated action','Reruns snapshot the latest ordered steps');
select ok((select bool_and(status='untested' and notes='' and tester_id is null and tested_at is null) from public.run_cases where run_id=(select id from context where key='retry')),'Reruns reset all result fields');
select is((select source_run_id from public.test_runs where id=(select id from context where key='retry')),(select id from context where key='run'),'Reruns retain source execution identity');
select is((select snapshot->>'title' from public.run_cases where run_id=(select id from context where key='run') and case_number=1),'Original case','Earlier snapshots remain unchanged');
select is((select notes from public.run_cases where run_id=(select id from context where key='run') and case_number=1),'Original notes','Earlier notes remain unchanged');
select ok((select status='completed' and completed_at is not null from public.test_runs where id=(select id from context where key='run')),'Earlier completion history is preserved');
select ok((select plan_id is null from public.test_runs where id=(select id from context where key='legacy')),'Legacy execution stays unlinked');
select is((select snapshot->>'title' from public.run_cases where run_id=(select id from context where key='legacy')),'Original case','Legacy snapshots are preserved');

insert into context select 'new_case',public.save_case('a1000000-0000-0000-0000-000000000001','Later group addition','','','medium','manual','[]','a2000000-0000-0000-0000-000000000001');
select is((select count(*) from public.plan_cases where plan_id='a4000000-0000-0000-0000-000000000001'),4::bigint,'New library group cases do not automatically enter plans');
select public.archive_case('a3000000-0000-0000-0000-000000000001');
select lives_ok($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Smoke','Updated coverage',array['a3000000-0000-0000-0000-000000000001'::uuid,'a3000000-0000-0000-0000-000000000003'::uuid,'a3000000-0000-0000-0000-000000000004'::uuid,(select id from context where key='new_case')],'a4000000-0000-0000-0000-000000000001')$$,'Plans can retain archived references while importing new cases');
select is((select count(*) from public.test_cases where id='a3000000-0000-0000-0000-000000000002'),1::bigint,'Removing a plan reference leaves the library case intact');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','New archived import','',array['a3000000-0000-0000-0000-000000000001'::uuid])$$,'%archived%','Archived cases cannot be newly imported');
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000001','Empty retry','',(select id from context where key='run'),'unsuccessful')$$,'%eligible cases%','Archived and removed unsuccessful cases are excluded');
insert into context select 'full_retry',public.create_plan_run('a4000000-0000-0000-0000-000000000001','Full retry','',(select id from context where key='run'));
select is((select count(*) from public.run_cases where run_id=(select id from context where key='full_retry')),3::bigint,'Full rerun uses current active membership including new imports');
select public.archive_plan('a4000000-0000-0000-0000-000000000001');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Archived edit','',array[]::uuid[],'a4000000-0000-0000-0000-000000000001')$$,'%archived%','Archived plans cannot be edited');
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000001','Archived run','')$$,'%archived%','Archived plans cannot start executions');
select public.record_result(id,'passed','Finished after plan archival') from public.run_cases where run_id=(select id from context where key='full_retry');
select lives_ok($$select public.complete_run((select id from context where key='full_retry'))$$,'Existing active runs can finish after plan archival');
select throws_like($$select public.record_result((select id from public.run_cases where run_id=(select id from context where key='full_retry') limit 1),'failed','')$$,'%completed%','Completed reruns retain result protection');
reset role;
-- Constraints enforce project consistency even for a privileged caller.
select throws_like($$insert into public.plan_cases(plan_id,case_id,project_id) values('a4000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000099','a1000000-0000-0000-0000-000000000001')$$,'%foreign key%','Plan membership has database-level project consistency');
update public.projects set archived_at=now() where id='a1000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_like($$select public.create_plan_run('a4000000-0000-0000-0000-000000000002','Archived project','')$$,'%membership%','Archived projects cannot start plan runs');
select throws_like($$select public.save_plan('a1000000-0000-0000-0000-000000000001','Archived project','',array[]::uuid[])$$,'%membership%','Archived projects cannot save plans');
select throws_like($$select public.record_result((select id from public.run_cases where run_id=(select id from context where key='retry') limit 1),'passed','')$$,'%archived%','Project archival keeps existing active runs read-only');
reset role;
update public.memberships set active=false where user_id='a0000000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select count(*) from public.test_plans),0::bigint,'Removed members lose plan access immediately');
select is((select count(*) from public.plan_cases),0::bigint,'Removed members lose included case access immediately');
select * from finish();
rollback;
