// All requests stay inside a disposable test container; no hosted account or key.
const {execFileSync}=require('node:child_process');
const {createHmac}=require('node:crypto');
const assert=require('node:assert/strict');
const container=process.argv[2];
assert.match(container??'',/^northlink-owl80-reveal-\d+$/);
const secret=process.env.OWL80_TEST_JWT_SECRET;
assert.ok(secret && secret.length>=32);
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
function token(user){
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const body=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role:'authenticated',sub:user,exp:Math.floor(Date.now()/1000)+120});
 return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
function request(path,{user,body,schema}={}){
 const args=['exec',container,'curl','-sS','-w','\n%{http_code}','http://127.0.0.1:3000/'+path];
 if(user)args.push('-H','Authorization: Bearer '+token(user));
 if(schema)args.push('-H','Accept-Profile: '+schema,'-H','Content-Profile: '+schema);
 if(body!==undefined)args.push('-H','Content-Type: application/json','-d',JSON.stringify(body));
 const output=execFileSync('docker',args,{encoding:'utf8'}),split=output.lastIndexOf('\n');
 return {status:Number(output.slice(split+1)),data:JSON.parse(output.slice(0,split))};
}
const endpoint='rpc/get_list_buyer_reveal';
const hidden=request(endpoint,{user:id(1),body:{p_list_id:id(101)}});
assert.equal(hidden.status,200);assert.equal(hidden.data.timezone,'America/New_York');
assert.ok(Number.isFinite(Date.parse(hidden.data.server_time)));
assert.ok(hidden.data.items.length>0);
for(const row of hidden.data.items){assert.equal(row.revealed,false);assert.equal(row.buyer_name,null);assert.ok(row.reveal_at);}
assert.equal(JSON.stringify(hidden.data).includes('Test 2'),false);
const revealed=request(endpoint,{user:id(1),body:{p_list_id:id(102)}});
assert.equal(revealed.status,200);assert.equal(revealed.data.items[0].revealed,true);
assert.equal(revealed.data.items[0].buyer_name,'Test 5');
assert.deepEqual(Object.keys(revealed.data.items[0]).sort(),['buyer_name','item_id','purchased_at','reveal_at','revealed']);
for(const user of [undefined,id(2),id(3),id(5),id(999)]){
 const response=request(endpoint,{user,body:{p_list_id:id(101)}});assert.ok([401,403].includes(response.status));
}
for(const body of [{p_list_id:id(101),p_now:'2999-12-26T05:00:00Z'},{p_list_id:id(101),p_owner_user_id:id(1)},{p_list_id:id(101),p_year:2025}]){
 const response=request(endpoint,{user:id(2),body});assert.ok(response.status>=400);
}
for(const list of [null,id(999)])assert.equal(request(endpoint,{user:id(1),body:{p_list_id:list}}).status,403);
const direct=request('items?select=*',{user:id(1)});assert.equal(direct.status,200);
assert.ok(direct.data.every(row=>!('buyer_name'in row)&&!('buyer_user_id'in row)&&!('purchased_by'in row)));
assert.equal(request('item_buyers?select=*',{user:id(1),schema:'northlink_private'}).status,406);
assert.ok(request('rpc/buyer_reveal_at',{user:id(1),body:{p_purchased_at:'2025-01-01T00:00:00Z'}}).status>=400);
// Existing buyer's own purchases continue to work, including thumbnails.
const purchases=request('rpc/get_my_purchases',{user:id(2),body:{}});assert.equal(purchases.status,200);
assert.ok(purchases.data.some(row=>row.id===id(201)));
assert.ok(purchases.data.every(row=>!('buyer_name'in row)&&!('buyer_user_id'in row)));
console.log('Timed buyer reveal PostgREST checks passed');
