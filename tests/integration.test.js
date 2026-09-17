const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

// In-memory Google services: no production data or email is changed by these tests.
const sheets = new Map(), cache = new Map(), properties = new Map([
  ['SPREADSHEET_ID','test-sheet'], ['ROOT_FOLDER_ID','test-root']
]);
class Sheet {
  constructor(){this.data=[];}
  appendRow(row){this.data.push([...row]);return this;}
  getLastRow(){return this.data.length;}
  getDataRange(){return {getValues:()=>this.data.map(r=>[...r])};}
  getRange(row,col,height,width){return {
    getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>this.data[row+i-1]?.[col+j-1]??'')),
    setValues:values=>{values.forEach((r,i)=>r.forEach((v,j)=>{this.data[row+i-1]??=[];this.data[row+i-1][col+j-1]=v;}));return this;},
    setFontWeight(){return this;},setBackground(){return this;},setFontColor(){return this;}
  };}
  setFrozenRows(){return this;}
}
const ss={getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet();sheets.set(n,s);return s;}};
const folders=new Map(), files=[];
class Folder {
  constructor(name){this.name=name;this.id=crypto.randomUUID();this.children=[];folders.set(this.id,this);}
  getId(){return this.id;}
  getFoldersByName(name){const matching=this.children.filter(f=>f.name===name);return {hasNext:()=>matching.length>0,next:()=>matching.shift()};}
  createFolder(name){const f=new Folder(name);this.children.push(f);return f;}
  createFile(blob){const f={id:crypto.randomUUID(),name:blob.getName(),folder:this.id};files.push(f);return {getId:()=>f.id};}
}
const root=new Folder('root');folders.set('test-root',root);
let quota=100, mailCount=0;
const context=vm.createContext({console:{error(){}},Date,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
  SpreadsheetApp:{openById:()=>ss},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},getUuid:()=>crypto.randomUUID(),sleep(){},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v).digest()].map(b=>b>127?b-256:b)},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},DriveApp:{getFolderById:id=>folders.get(id)},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:()=>{mailCount++;}}
});
for(const file of ['Core.gs','Code.gs','AuthorAccounts.gs'])vm.runInContext(fs.readFileSync('backend/apps-script/'+file,'utf8'),context,{filename:file});
const call=(name,arg)=>context[name](arg);
const blob=(name,length=10)=>({getName:()=>name,setName:v=>{name=v;},getBytes:()=>({length})});
const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r.data;};
const reject=r=>assert.equal(r.ok,false);
context.setupSystem();
const credentials={username:'qa_author',displayName:'QA Author',email:'qa@example.com',password:'QaPassword!2026'};
const owner=ok(call('registerAuthor',credentials));
assert.equal(sheets.get('USERS').data[1][1],'qa_author');
assert.notEqual(sheets.get('USERS').data[1][5],credentials.password);
assert.equal(sheets.get('USERS').data[1][5].length,64);
reject(call('registerAuthor',credentials));
reject(call('registerAuthor',{...credentials,username:'x'}));
reject(call('authorLogin',{...credentials,password:'wrong'}));
const login=ok(call('authorLogin',credentials));
assert.notEqual(login.token,owner.token);
ok(call('authorLogout',login.token));
reject(call('getMyManuscripts',{token:login.token}));
assert.equal(ok(call('getMyManuscripts',{token:owner.token})).length,0);
const other=ok(call('registerAuthor',{...credentials,username:'qa_other'}));
const form=()=>({author_token:owner.token,title_th:'QA manuscript',title_en:'QA manuscript',article_type:'RESEARCH',department:'QA',keywords_th:'QA',keywords_en:'QA',work_origin:'QA',
  authors_json:JSON.stringify([{name_th:'QA Author',name_en:'QA Author',role:'STAFF',email:'qa@example.com',phone:'0800000000'}]),
  certify_correct:'true',certify_exclusive:'true',consent_review:'true',accept_ethics:'true',word_file:blob('qa.docx'),pdf_file:blob('qa.pdf')});
reject(call('submitManuscript',{...form(),author_token:'invalid'}));
reject(call('submitManuscript',{...form(),authors_json:'bad JSON'}));
reject(call('submitManuscript',{...form(),certify_correct:''}));
const submitted=ok(call('submitManuscript',form()));
assert.match(submitted.manuscriptId,/^STJ-\d{4}-001$/);
assert.equal(files.length,2);
assert.ok(files.every(f=>f.name.startsWith(submitted.manuscriptId+'_')));
assert.equal(root.children[0].children[0].children.length,5);
assert.equal(mailCount,1);
assert.equal(sheets.get('SUBMISSIONS').data.length,2);
assert.equal(sheets.get('AUTHORS').data.length,2);
assert.equal(sheets.get('STATUS_LOG').data.length,2);
assert.equal(ok(call('getMyManuscripts',{token:owner.token})).length,1);
assert.equal(ok(call('getMyManuscripts',{token:other.token})).length,0);
reject(call('trackManuscript',{manuscriptId:submitted.manuscriptId,email:'wrong@example.com'}));
const tracked=ok(call('trackManuscript',{manuscriptId:submitted.manuscriptId.toLowerCase(),email:' QA@EXAMPLE.COM '}));
assert.equal(tracked.timeline.length,1);
assert.equal(tracked.private_note,undefined);
assert.equal(tracked.word_file_id,undefined);
reject(call('getDashboard',{token:'invalid'}));
assert.match(call('editorLogin',{password:'anything'}).error,/ยังไม่ได้ตั้งรหัสผ่านกลาง/);
assert.throws(()=>context.setEditorialPassword_('12345'));
context.setEditorialPassword_('123456');
reject(call('editorLogin',{password:'wrong'}));
const editor=ok(call('editorLogin',{password:'123456'}));
assert.equal(ok(call('getDashboard',{token:editor.token,query:'QA',status:'SUBMITTED',type:'RESEARCH'})).rows.length,1);
assert.equal(ok(call('getSubmissionDetail',{token:editor.token,manuscriptId:submitted.manuscriptId})).authors.length,1);
reject(call('updateSubmissionStatus',{token:editor.token,manuscriptId:submitted.manuscriptId,status:'INVALID'}));
ok(call('updateSubmissionStatus',{token:editor.token,manuscriptId:submitted.manuscriptId,status:'REVIEW',publicNote:'QA public',privateNote:'QA SECRET'}));
const updated=ok(call('trackManuscript',{manuscriptId:submitted.manuscriptId,email:'qa@example.com'}));
assert.equal(updated.status,'REVIEW');assert.equal(updated.timeline.length,2);
assert.ok(!JSON.stringify(updated).includes('QA SECRET'));
ok(call('editorLogout',editor.token));reject(call('getDashboard',{token:editor.token}));
reject(call('submitManuscript',{...form(),word_file:blob('qa.exe')}));
reject(call('submitManuscript',{...form(),pdf_file:blob('qa.pdf',16*1024*1024)}));
quota=0;const second=ok(call('submitManuscript',form()));
assert.match(second.manuscriptId,/-002$/);assert.ok(second.emailWarning);
for(let i=0;i<5;i++)reject(call('authorLogin',{username:'qa_missing',password:'wrong'}));
assert.match(call('authorLogin',{username:'qa_missing',password:'wrong'}).error,/10/);
context.Utilities.base64Decode=value=>Array.from(Buffer.from(value,'base64'));
context.Utilities.newBlob=(bytes,mime,name)=>blob(name,bytes.length);
vm.runInContext(fs.readFileSync('backend/apps-script/WebSubmission.gs','utf8'),context);
const webForm=()=>({...form(),word_file:{name:'qa.docx',base64:Buffer.from('PK-word').toString('base64')},pdf_file:{name:'qa.pdf',base64:Buffer.from('%PDF-test').toString('base64')}});
const beforeWeb=sheets.get('SUBMISSIONS').data.length;
reject(call('submitManuscriptFromWeb',{...webForm(),author_token:'invalid'}));
reject(call('submitManuscriptFromWeb',{...webForm(),word_file:{name:'bad.exe',base64:'YQ=='}}));
reject(call('submitManuscriptFromWeb',{...webForm(),pdf_file:{name:'qa.pdf',base64:'%%%='}}));
reject(call('submitManuscriptFromWeb',{...webForm(),pdf_file:null}));
reject(call('submitManuscriptFromWeb',{...webForm(),pdf_file:{name:'qa.pdf',base64:Buffer.from('not pdf').toString('base64')}}));
reject(call('submitManuscriptFromWeb',{...webForm(),word_file:{name:'qa.docx',base64:'a'.repeat(20971524)}}));
assert.equal(sheets.get('SUBMISSIONS').data.length,beforeWeb);
const fromWeb=ok(call('submitManuscriptFromWeb',webForm()));
assert.equal(sheets.get('SUBMISSIONS').data.length,beforeWeb+1);
assert.ok(ok(call('getMyManuscripts',{token:owner.token})).some(r=>r.manuscriptId===fromWeb.manuscriptId));
assert.equal(ok(call('getMyManuscripts',{token:other.token})).length,0);
console.log('PASS integration: accounts, files, submission, ownership, tracking, editorial workflow, quota, rate limit and GitHub upload validation');
module.exports={context,sheets,cache,properties,Folder,files,root,form,owner,other,blob,ss,ok,reject};
