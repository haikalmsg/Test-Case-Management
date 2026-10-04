begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000001','admin@test.local',now()),
 ('00000000-0000-0000-0000-000000000002','member@test.local',now()),
 ('00000000-0000-0000-0000-000000000003','outsider@test.local',now()),
 ('00000000-0000-0000-0000-000000000004','removed@test.local',now()),
 ('00000000-0000-0000-0000-000000000005','second-admin@test.local',now());
insert into public.memberships(user_id,role,active) values
 ('00000000-0000-0000-0000-000000000001','admin',true),
 ('00000000-0000-0000-0000-000000000002','member',true),
 ('00000000-0000-0000-0000-000000000004','member',false);
insert into public.projects(id,code,name,created_by) values
 ('10000000-0000-0000-0000-000000000001','QA','Main project','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','OTHER','Other project','00000000-0000-0000-0000-000000000001');
insert into public.suites(id,project_id,name) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Other suite');
insert into public.test_cases(id,project_id,title,created_by) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Original title','00000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Second case','00000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Other case','00000000-0000-0000-0000-000000000001');
insert into public.case_steps(case_id,position,action,expected_result) values('30000000-0000-0000-0000-000000000001',0,'Original action','Original expected');
create temp table context(key text primary key,id uuid);
grant all on context to authenticated;

set local role anon;
select throws_like('select * from public.projects','%permission denied%', 'Anonymous users cannot read projects');
select throws_like($$select public.dashboard_summary()$$,'%permission denied%', 'Anonymous users cannot call RPCs');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select is((select count(*) from public.projects),0::bigint,'Nonmembers see no projects');
select is((select count(*) from public.test_cases),0::bigint,'Nonmembers see no cases');
select is((select count(*) from public.profiles),1::bigint,'Nonmembers only see their profile');
select throws_like($$select public.create_run('10000000-0000-0000-0000-000000000001','Run','',array['30000000-0000-0000-0000-000000000001'::uuid])$$,'%membership%', 'Nonmembers cannot create runs');
select throws_like($$insert into public.memberships(user_id,role) values('00000000-0000-0000-0000-000000000003','admin')$$,'%permission denied%', 'Users cannot grant themselves membership');
select throws_like($$select public.dashboard_summary()$$,'%membership%', 'Nonmembers cannot read dashboard totals');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select is((select count(*) from public.projects),0::bigint,'Removed members see no projects');
select throws_like($$select public.archive_case('30000000-0000-0000-0000-000000000001')$$,'%membership%', 'Removed members cannot mutate cases');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select is((select count(*) from public.projects),2::bigint,'Members read the shared workspace');
select throws_like($$insert into public.projects(code,name) values('NO','Not allowed')$$,'%row-level security%', 'Members cannot create projects');
update public.projects set name='Hacked';
select is((select count(*) from public.projects where name='Hacked'),0::bigint,'Members cannot edit projects');
select throws_like($$update public.memberships set role='admin' where user_id=auth.uid()$$,'%permission denied%', 'Direct role escalation is denied');
select throws_like($$select public.manage_member('00000000-0000-0000-0000-000000000002','admin',true)$$,'%Admin required%', 'Role escalation through RPC is denied');
select throws_like($$select public.prepare_invitation('attacker@test.local','admin')$$,'%Admin required%', 'Members cannot invite admins');
select throws_like($$update public.test_cases set title='Direct write'$$,'%permission denied%', 'Case mutations require the transactional RPC');
select throws_like($$select public.save_case(p_project_id=>'10000000-0000-0000-0000-000000000001',p_title=>'Invalid',p_description=>'',p_preconditions=>'',p_priority=>'medium',p_classification=>'manual',p_steps=>'[]',p_suite_id=>'20000000-0000-0000-0000-000000000001')$$,'%another project%', 'Cross-project suites are rejected');
select lives_ok($$select public.save_case(p_project_id=>'10000000-0000-0000-0000-000000000001',p_title=>'New case',p_description=>'',p_preconditions=>'',p_priority=>'medium',p_classification=>'manual',p_steps=>'[]')$$,'Members create cases without a suite');
select is((select number from public.test_cases where title='New case'),3,'Case numbering is project-scoped');
select throws_like($$select public.save_case(p_project_id=>'10000000-0000-0000-0000-000000000001',p_title=>'Bad steps',p_description=>'',p_preconditions=>'',p_priority=>'medium',p_classification=>'manual',p_steps=>'[{"action":"","expected_result":""}]')$$,'%needs an action%', 'Empty steps are rejected');
select is((select count(*) from public.test_cases where title='Bad steps'),0::bigint,'Invalid steps roll back case creation');
select throws_like($$select public.create_run('10000000-0000-0000-0000-000000000001','Empty','',array[]::uuid[])$$,'%unique cases%', 'Empty runs are rejected');
select throws_like($$select public.create_run('10000000-0000-0000-0000-000000000001','Duplicate','',array['30000000-0000-0000-0000-000000000001'::uuid,'30000000-0000-0000-0000-000000000001'::uuid])$$,'%unique cases%', 'Duplicate selections are rejected');
select throws_like($$select public.create_run('10000000-0000-0000-0000-000000000001','Cross-project','',array['30000000-0000-0000-0000-000000000001'::uuid,'30000000-0000-0000-0000-000000000003'::uuid])$$,'%another project%', 'Cross-project cases are rejected');
select is((select count(*) from public.test_runs),0::bigint,'Failed run creation leaves no partial run');
insert into context select 'run',public.create_run('10000000-0000-0000-0000-000000000001','Smoke test','Staging',array['30000000-0000-0000-0000-000000000001'::uuid,'30000000-0000-0000-0000-000000000002'::uuid]);
select is((select count(*) from public.run_cases),2::bigint,'Run atomically includes every selected case');
select is((select snapshot->>'title' from public.run_cases where case_number=1),'Original title','Run snapshots the case title');
select is((select snapshot->'steps'->0->>'action' from public.run_cases where case_number=1),'Original action','Run snapshots ordered steps');
select lives_ok($$select public.save_case(p_project_id=>'10000000-0000-0000-0000-000000000001',p_title=>'Changed title',p_description=>'',p_preconditions=>'',p_priority=>'high',p_classification=>'automated',p_steps=>'[{"action":"Changed action","expected_result":"Changed expected"}]',p_case_id=>'30000000-0000-0000-0000-000000000001')$$,'Members edit repository cases');
select is((select snapshot->>'title' from public.run_cases where case_number=1),'Original title','Repository edits preserve run snapshots');
select is((select snapshot->'steps'->0->>'action' from public.run_cases where case_number=1),'Original action','Step edits preserve run snapshots');
select throws_like($$update public.run_cases set snapshot='{}'$$,'%permission denied%', 'Clients cannot tamper with snapshots');
select throws_like($$insert into public.test_runs(project_id,name,created_by) values('10000000-0000-0000-0000-000000000001','Bypass',auth.uid())$$,'%permission denied%', 'Clients cannot bypass atomic run creation');
select throws_like($$select public.complete_run((select id from context where key='run'))$$,'%every case%', 'Untested cases prevent completion');
select lives_ok($$select public.record_result((select id from public.run_cases where case_number=1),'passed','Works')$$,'Members record results');
select is((select tester_id from public.run_cases where case_number=1),'00000000-0000-0000-0000-000000000002'::uuid,'Tester comes from the authenticated identity');
select ok((select tested_at is not null from public.run_cases where case_number=1),'Terminal result gets a timestamp');
select lives_ok($$select public.record_result((select id from public.run_cases where case_number=2),'failed','Defect found')$$,'Failed results are recorded');
select is((public.dashboard_summary()->'results'->>'passed')::integer,1,'Dashboard counts passed results');
select is((public.dashboard_summary()->'results'->>'failed')::integer,1,'Dashboard counts failed results');
select lives_ok($$select public.archive_case('30000000-0000-0000-0000-000000000001')$$,'Repository cases can be archived');
select is((select snapshot->>'title' from public.run_cases where case_number=1),'Original title','Archiving cases preserves snapshots');
select lives_ok($$select public.complete_run((select id from context where key='run'))$$,'Fully executed run can be completed');
select is((select status::text from public.test_runs),'completed','Completion persists');
select throws_like($$select public.record_result((select id from public.run_cases where case_number=1),'failed','Change')$$,'%completed%', 'Completed runs reject result edits');
select throws_like($$update public.test_runs set status='active'$$,'%permission denied%', 'Direct reopening is denied');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select lives_ok($$insert into public.projects(code,name) values('NEW','Admin project')$$,'Admins create projects');
select throws_like($$select public.manage_member('00000000-0000-0000-0000-000000000001','member',true)$$,'%last admin%', 'Last admin cannot be demoted');
select throws_like($$select public.manage_member('00000000-0000-0000-0000-000000000001','admin',false)$$,'%last admin%', 'Last admin cannot be removed');
select lives_ok($$select public.manage_member('00000000-0000-0000-0000-000000000002','admin',true)$$,'Admins promote members');
select lives_ok($$select public.manage_member('00000000-0000-0000-0000-000000000002','member',true)$$,'Admins demote when another admin remains');
select lives_ok($$select public.prepare_invitation('outsider@test.local','member')$$,'Admins prepare invitations');
select lives_ok($$select public.revoke_invitation((select id from public.invitations where email='outsider@test.local'))$$,'Admins revoke invitations');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select throws_like($$select public.accept_invitation()$$,'%No valid invitation%', 'Revoked invitation cannot be accepted');
reset role;
update public.invitations set revoked_at=null,created_at=now()-interval '8 days' where email='outsider@test.local';
set local role authenticated;
select throws_like($$select public.accept_invitation()$$,'%No valid invitation%', 'Expired invitation cannot be accepted');
reset role;
update public.invitations set created_at=now() where email='outsider@test.local';
set local role authenticated;
select lives_ok($$select public.accept_invitation()$$,'Verified invited user accepts membership');
select is((select role::text from public.memberships where user_id=auth.uid()),'member','Invitation grants its stored role');
select throws_like($$select public.accept_invitation()$$,'%No valid invitation%', 'Invitation cannot be accepted twice');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.manage_member('00000000-0000-0000-0000-000000000003','member',false)$$,'Admins remove access');
select lives_ok($$update public.projects set archived_at=now() where id='10000000-0000-0000-0000-000000000001'$$,'Admins archive projects');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select throws_like($$select public.create_run('10000000-0000-0000-0000-000000000001','Archived project','',array['30000000-0000-0000-0000-000000000002'::uuid])$$,'%membership%', 'Archived projects reject new runs');
select is((select count(*) from public.test_runs),1::bigint,'Archived project history remains readable');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select is((select count(*) from public.run_cases),0::bigint,'Removed members immediately lose result access');
select * from finish();
rollback;
