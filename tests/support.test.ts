import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validateIssue,submitIssue,listIssues,setIssueStatus} from '../lib/support.ts';
process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-support-'));
const input={name:'Visitor',email:'visitor@example.com',category:'Broken download link',subject:'Mirror unavailable',message:'The first mirror returns a missing file error.',page:'https://example.com/movies/tmdb-1'};
test('contact validation handles useful reports and rejects bad input',()=>{
 assert.equal(validateIssue(input).category,'Broken download link');assert.equal(validateIssue({...input,email:''}).email,'');
 for(const value of [{...input,email:'not-email'},{...input,message:'short'},{...input,page:'javascript:alert(1)'},{...input,page:'https://user:pass@example.com/'},{...input,category:'bad'},{...input,subject:''},{...input,website:'spam'},{...input,message:'x'.repeat(5001)}])assert.throws(()=>validateIssue(value));
});
test('reports persist privately with references and support resolve/reopen; stored rate limiting survives requests',async ()=>{
 const result=(await submitIssue(input,'client-one'));assert.match(result.reference,/^[A-F0-9]{8}$/);let issues=(await listIssues());assert.equal(issues.length,1);assert.equal(issues[0].message,input.message);assert.equal(issues[0].status,'new');assert.equal('client_hash' in issues[0],false);
 assert.equal((await setIssueStatus(issues[0].id,'closed')),true);assert.equal((await listIssues())[0].status,'closed');assert.equal((await setIssueStatus(issues[0].id,'new')),true);(await assert.rejects(async ()=>(await setIssueStatus(issues[0].id,'invalid'))));
 for(let i=0;i<4;i++)(await submitIssue(input,'client-one'));(await assert.rejects(async ()=>(await submitIssue(input,'client-one')),/Too many/));assert.equal((await listIssues()).length,5);(await submitIssue(input,'client-two'));assert.equal((await listIssues()).length,6);
});

test('release requests use the private inbox and retain movie/edition details',async ()=>{
 const request={...input,category:'Release request',subject:'A requested movie (2024)',message:'Please consider an Open Matte edition with English audio.'};assert.equal(validateIssue(request).category,'Release request');const result=(await submitIssue(request,'request-client'));assert.match(result.reference,/^[A-F0-9]{8}$/);const row=(await listIssues()).find(issue=>issue.subject===request.subject);assert.equal(row?.category,'Release request');assert.equal(row?.message,request.message);assert.equal(row?.status,'new');
});
