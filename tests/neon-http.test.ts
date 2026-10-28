import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAppClient} from '../scripts/neon-test-http.mjs';
import {sameOrigin} from '../lib/auth.ts';

test('live contact verification sends the same Origin as the production app',async()=>{
 const call=createAppClient('http://127.0.0.1:3107','private-admin-token',async(input,init)=>{
  const request=new Request(input,init);
  assert.equal(sameOrigin(request),true);
  assert.equal(request.headers.get('authorization'),null);
  return Response.json({reference:'A1B2C3D4'},{status:201});
 });
 assert.equal((await call('/api/contact',{subject:'Verification'})).reference,'A1B2C3D4');
});

test('live authenticated writes retain bearer authentication and same-origin headers',async()=>{
 const call=createAppClient('http://127.0.0.1:3107','private-admin-token',async(input,init)=>{
  const request=new Request(input,init);
  assert.equal(sameOrigin(request),true);
  assert.equal(request.headers.get('authorization'),'Bearer private-admin-token');
  return Response.json({updated:true});
 });
 assert.equal((await call('/api/admin/support',{id:'fixture',status:'closed'},true)).updated,true);
});

test('live verification reports the route and HTTP status when an endpoint rejects a request',async()=>{
 const call=createAppClient('http://127.0.0.1:3107','private-admin-token',async()=>Response.json({error:'Denied'},{status:403}));
 await assert.rejects(()=>call('/api/contact',{subject:'Verification'}),/\/api\/contact returned HTTP 403/);
});

