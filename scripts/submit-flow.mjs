import fs from "node:fs";
import Database from "better-sqlite3";
import { SignJWT } from "jose";
import crypto from "node:crypto";
const env = fs.readFileSync(".env.local","utf8"); const secret = env.match(/SESSION_SECRET=(.+)/)[1].trim();
const base="http://localhost:3100"; const db=new Database(".data/audit.db");
const u=db.prepare("select * from users where email='auditor@crunchiesfood.com'").get();
const sid=crypto.randomUUID(); const now=new Date();
db.prepare("insert into sessions (id,user_id,token_id,ip,user_agent,created_at,last_seen_at,expires_at) values (?,?,?,?,?,?,?,?)").run(crypto.randomUUID(),u.id,sid,'127.0.0.1','flow-test',now.toISOString(),now.toISOString(),new Date(Date.now()+3600000).toISOString());
const token=await new SignJWT({uid:u.id,sid,role:u.role,name:u.name}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const cookie=`crunchies_audit_session=${token}`;
const audit=db.prepare("select * from audits where auditor_id=? and status='scheduled' limit 1").get(u.id);
if(!audit){console.log('NO SCHEDULED AUDIT');process.exit(1);}
const questions=db.prepare("select * from checklist_questions where template_id=? and active=1 order by sort_order").all(audit.template_id);
const form=new FormData(); form.set("file",new File([Buffer.from("submit flow evidence")],"submit-flow.txt",{type:"text/plain"})); form.set("auditId",audit.id); form.set("category","audit_evidence");
const up=await fetch(base+"/api/upload",{method:"POST",headers:{cookie,origin:base},body:form}); const upJson=await up.json();
if(!up.ok){console.log('UPLOAD FAIL',up.status,upJson);process.exit(1);}
let saved=0;
for(const q of questions){
  const payload={auditId:audit.id,questionId:q.id,result:null,comment:"Full submission flow test",documentIds:q.evidence_required!=="none"?[upJson.id]:[]};
  if(q.response_type==="compliance") payload.result="compliant";
  else if(q.response_type==="yes_no") payload.result="yes";
  else if(q.response_type==="numeric") payload.numericValue=0;
  else if(q.response_type==="financial") payload.amountKobo=0;
  else payload.textValue="Verified";
  const r=await fetch(base+"/api/checklist/save",{method:"POST",headers:{cookie,"content-type":"application/json",origin:base},body:JSON.stringify(payload)});
  if(!r.ok){console.log('SAVE FAIL',r.status,await r.text());process.exit(1);} saved++;
}
console.log('saved',saved,'questions');
const sub=await fetch(base+"/api/audits/submit",{method:"POST",headers:{cookie,"content-type":"application/json",origin:base},body:JSON.stringify({auditId:audit.id})});
const subJson=await sub.json(); console.log('submit',sub.status,subJson);
const row=db.prepare("select status,score,locked_at from audits where id=?").get(audit.id);
console.log('audit row',row);
const res2=await fetch(base+"/api/checklist/save",{method:"POST",headers:{cookie,"content-type":"application/json",origin:base},body:JSON.stringify({auditId:audit.id,questionId:questions[0].id,result:"compliant"})});
console.log('locked edit',res2.status, await res2.text());
const detail=await fetch(base+`/audits/${audit.id}`,{headers:{cookie}});
console.log('detail',detail.status);
if(sub.status!==200||row.locked_at==null||res2.status!==409||detail.status!==200){console.log('FLOW FAIL');process.exit(1);}
console.log('SUBMIT FLOW PASS');
