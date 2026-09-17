// Additive schema. Existing sheet headers and records are never replaced.
var JOURNAL_SCHEMA_ = {
  REVIEWER_PROFILES:['reviewer_id','prefix','first_name','last_name','name_en','position','qualification','subject_area','phone','notes','created_at','updated_at'],
  REVIEW_ASSIGNMENTS:['assignment_id','manuscript_id','reviewer_id','round','version','assigned_at','assigned_by','due_at','invitation_status','review_status','completed_at','declined_reason','cancelled_at','blind_file_id'],
  REVIEW_RESULTS:['review_id','assignment_id','scores_json','strengths','suggestions','comment_to_author','confidential_comment','recommendation','submitted_at','locked_at'],
  REVIEW_DRAFTS:['assignment_id','draft_json','updated_at'],
  REVISIONS:['revision_id','manuscript_id','version','submitted_by','submitted_at','responses_json','response_letter_file_id'],
  DECISIONS:['decision_id','manuscript_id','version','round','type','message_to_author','internal_note','decided_by','decided_at','revision_due_at','feedback_json'],
  FILES:['file_id','manuscript_id','version','file_type','original_name','stored_name','storage_id','uploaded_by','uploaded_at','visibility','assignment_id','checksum'],
  WORKFLOW_META:['manuscript_id','current_version','accepted_at','revised_at','proof_version','issue_id'],
  PROOF_CHECKS:['manuscript_id','version','checks_json','checked_by','checked_at','note'],
  AUTHOR_PROOFS:['proof_id','manuscript_id','version','result','message','confirmed_by','confirmed_at'],
  ACCEPTANCE_LETTERS:['letter_id','manuscript_id','letter_number','issued_at','file_id','editor_name'],
  ISSUES:['issue_id','volume','issue_number','month','year_be','year_ce','publication_date','cover_file_id','description','status','published_at'],
  ISSUE_ARTICLES:['issue_id','manuscript_id','sequence','page_start','page_end'],
  PUBLICATIONS:['manuscript_id','issue_id','public_json','pdf_file_id','published_at'],
  NOTIFICATIONS:['notification_id','recipient','template','manuscript_id','subject','body','dedupe_key','status','attempts','sent_at','next_attempt_at','safe_error'],
  REMINDER_LOG:['assignment_id','reminder_type','due_date','sent_at'],
  AUDIT_LOG:['event_id','user_id','role','action','manuscript_id','old_value','new_value','occurred_at','operation_id'],
  USER_ROLES:['user_id','role','active'],
  PRODUCTION_ASSIGNMENTS:['manuscript_id','user_id','assigned_at'],
  ACCESS_TOKENS:['token_hash','reviewer_id','assignment_id','purpose','expires_at','used_at','revoked_at'],
  OPERATIONS:['operation_id','actor_id','action','state','result_json','started_at'],
  MIGRATIONS:['migration_id','executed_at','backup_id','schema_version']
};
var JOURNAL_STATES_={DOCUMENT_CHECK:'ตรวจสอบเอกสาร',REVIEWER_ASSIGNMENT:'รอมอบหมายผู้ทรงคุณวุฒิ',UNDER_REVIEW:'อยู่ระหว่างประเมิน',REVISION_REQUIRED:'ต้องแก้ไขบทความ',REVISED:'ได้รับฉบับแก้ไข',FINAL_REVIEW:'พิจารณาผลขั้นสุดท้าย',PROOFREADING:'ตรวจภาษาและพิสูจน์อักษร',AUTHOR_PROOF:'รอผู้เขียนตรวจ Proof',READY_TO_PUBLISH:'พร้อมเผยแพร่',WITHDRAWN:'ถอนบทความ'};
function journalStates_(){return Object.assign({},STJ_STATUSES_,JOURNAL_STATES_);}
function jCanonical_(s){return {CHECKING:'DOCUMENT_CHECK',REVIEW:'UNDER_REVIEW',REVISION:'REVISION_REQUIRED',RECHECK:'REVISED',PROOFREAD:'PROOFREADING'}[s]||s;}
function jUuid_(){return Utilities.getUuid();}
function jNow_(){return new Date().toISOString();}
function jReady_(){if(properties_().getProperty('JOURNAL_READY')!=='true')throw userError_('กองบรรณาธิการต้องเตรียมระบบวารสารก่อนใช้งานส่วนนี้');}
function jRows_(name){return rows_(name);}
function jAppend_(name,obj){sheet_(name).appendRow(JOURNAL_SCHEMA_[name].map(function(h){return safeCell_(obj[h]);}));}
function jUpdate_(name,row,obj){var sh=sheet_(name),headers=JOURNAL_SCHEMA_[name],old=sh.getRange(row,1,1,headers.length).getValues()[0];sh.getRange(row,1,1,headers.length).setValues([headers.map(function(h,i){return Object.prototype.hasOwnProperty.call(obj,h)?safeCell_(obj[h]):old[i];})]);}
function jFind_(name,key,value){return jRows_(name).find(function(r){return String(r[key])===String(value);});}
function jUpsert_(name,key,obj){var r=jFind_(name,key,obj[key]);if(r)jUpdate_(name,r._row,obj);else jAppend_(name,obj);}
function jJson_(value,fallback){try{return JSON.parse(String(value));}catch(e){return fallback;}}
function jManuscript_(id){var s=rows_('SUBMISSIONS').find(function(r){return r.manuscript_id===normalizeId_(id);});if(!s)throw userError_('ไม่พบบทความ');return s;}
function jOwner_(uid,id){if(!rows_('USER_SUBMISSIONS').some(function(r){return r.user_id===uid&&r.manuscript_id===id;}))throw userError_('ไม่มีสิทธิ์เข้าถึงบทความนี้');}
function jMeta_(s){return jFind_('WORKFLOW_META','manuscript_id',s.manuscript_id)||{manuscript_id:s.manuscript_id,current_version:1};}
function jAudit_(actor,action,id,oldValue,newValue,operation){jAppend_('AUDIT_LOG',{event_id:jUuid_(),user_id:actor.id,role:actor.role,action:action,manuscript_id:id||'',old_value:oldValue||'',new_value:newValue||'',occurred_at:jNow_(),operation_id:operation||''});}
function jActor_(q,role){
  if(role==='EDITOR'){requireEditor_(q.token);var uid=CacheService.getScriptCache().get('author:'+digest_(String(q.token)));return {id:uid||'EDITOR_SHARED',role:'EDITOR'};}
  if(role==='AUTHOR')return {id:requireAuthor_(q.token),role:'AUTHOR'};
  if(role==='REVIEWER'){var id=q.token&&CacheService.getScriptCache().get('reviewer:'+digest_(q.token));var r=id&&rows_('REVIEWERS').find(function(x){return x.reviewer_id===id&&String(x.active)==='true';});if(!r)throw userError_('กรุณาเข้าสู่ระบบผู้ประเมินอีกครั้ง');return {id:id,role:'REVIEWER'};}
  if(role==='PROOFREADER'){try{return jActor_(q,'EDITOR');}catch(e){var uid=requireAuthor_(q.token);if(!jRows_('USER_ROLES').some(function(x){return x.user_id===uid&&String(x.active)==='true'&&['PROOFREADER','EDITOR','ADMIN','MANAGING_EDITOR'].indexOf(x.role)>=0;}))throw userError_('ไม่มีสิทธิ์งานตรวจภาษา');return {id:uid,role:'PROOFREADER'};}}
  throw userError_('ไม่มีสิทธิ์ดำเนินการ');
}
function jRead_(q,role,fn){return response_(function(){jReady_();return fn(jActor_(q||{},role));});}
function jWrite_(q,action,role,fn){return response_(function(){
  jReady_();var actor=jActor_(q||{},role),op=clean_(q.operationId,100);if(!/^[a-zA-Z0-9_-]{8,100}$/.test(op))throw userError_('กรุณารีเฟรชหน้าเว็บแล้วลองอีกครั้ง');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{var previous=jRows_('OPERATIONS').find(function(r){return r.operation_id===op&&r.actor_id===actor.id&&r.action===action;});
    if(previous){if(previous.state==='COMPLETE')return jJson_(previous.result_json,{});throw userError_('รายการนี้กำลังตรวจสอบ กรุณาติดต่อกองบรรณาธิการก่อนส่งซ้ำ');}
    ['blindFile','wordFile','pdfFile','coverFile','responseFile','file'].forEach(function(key){if(q[key])jValidateUpload_(q[key],{blindFile:'BLIND_PDF',wordFile:'WORD',pdfFile:'PDF',coverFile:'COVER'}[key]||'ATTACHMENT');});
    // Validate inside the lock before creating an operation record.
    var transaction={started:false,start:function(){if(this.started)return;this.started=true;jAppend_('OPERATIONS',{operation_id:op,actor_id:actor.id,action:action,state:'RUNNING',started_at:jNow_()});}};
    try{var result=fn(actor,transaction);transaction.start();var record=jRows_('OPERATIONS').find(function(r){return r.operation_id===op&&r.actor_id===actor.id&&r.action===action;});jUpdate_('OPERATIONS',record._row,{state:'COMPLETE',result_json:JSON.stringify(result||{})});jAudit_(actor,action,q.manuscriptId,'','บันทึกสำเร็จ',op);return result||{};}
    catch(e){if(transaction.started){var record=jRows_('OPERATIONS').find(function(r){return r.operation_id===op&&r.actor_id===actor.id&&r.action===action;});if(record)jUpdate_('OPERATIONS',record._row,{state:'NEEDS_RECOVERY'});}throw e;}
  }finally{lock.releaseLock();}
});}
function jTransition_(s,status,actor,message,internal){var now=jNow_();update_('SUBMISSIONS',s._row,{status:status,public_note:clean_(message,2000),private_note:clean_(internal,2000),updated_at:now});append_('STATUS_LOG',{manuscript_id:s.manuscript_id,changed_at:now,from_status:s.status,to_status:status,public_note:clean_(message,2000),private_note:clean_(internal,2000),actor:actor.id});jAudit_(actor,'STATUS_CHANGE',s.manuscript_id,s.status,status);s.status=status;}
function setupJournal(q){return response_(function(){
  requireEditor_(q&&q.token);if(q.logoFile)jValidateUpload_(q.logoFile,'COVER');var p=properties_();if(p.getProperty('JOURNAL_READY')==='true')return {ready:true,backupId:p.getProperty('JOURNAL_BACKUP_ID')};
  var lock=LockService.getScriptLock();lock.waitLock(30000);try{
    var backup=spreadsheet_().copy('STJ Backup '+jNow_());DriveApp.getFileById(backup.getId()).setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);p.setProperty('JOURNAL_BACKUP_ID',backup.getId());
    DriveApp.getFileById(requiredProperty_('SPREADSHEET_ID')).setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
    var root=DriveApp.getFolderById(requiredProperty_('ROOT_FOLDER_ID')),storageBackup=DriveApp.createFolder('STJ File Backup '+jNow_());storageBackup.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
    function secure(folder,target){folder.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);var files=folder.getFiles();while(files.hasNext()){var f=files.next();f.makeCopy(f.getName(),target).setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);f.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);}var children=folder.getFolders();while(children.hasNext()){var child=children.next();secure(child,target.createFolder(child.getName()));}}
    secure(root,storageBackup);p.setProperty('JOURNAL_FILES_BACKUP_ID',storageBackup.getId());
    Object.keys(JOURNAL_SCHEMA_).forEach(function(name){var ss=spreadsheet_(),sh=ss.getSheetByName(name)||ss.insertSheet(name),headers=JOURNAL_SCHEMA_[name];if(!sh.getLastRow())sh.appendRow(headers);else if(sh.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|'))throw userError_('โครงสร้างข้อมูลไม่ตรง กรุณาติดต่อผู้ดูแล');sh.setFrozenRows(1);});
    jAppend_('MIGRATIONS',{migration_id:jUuid_(),executed_at:jNow_(),backup_id:backup.getId(),schema_version:'2'});if(q.logoFile){var lf=jSaveFile_(null,{id:'EDITOR_SHARED'},q.logoFile,'COVER',1,'EDITOR');p.setProperty('JOURNAL_LOGO_FILE_ID',jFind_('FILES','file_id',lf).storage_id);}rows_('SUBMISSIONS').forEach(jRegisterOriginals_);p.setProperty('JOURNAL_READY','true');
    if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='processJournalJobs_';}))ScriptApp.newTrigger('processJournalJobs_').timeBased().everyHours(6).create();
    jAudit_({id:'EDITOR_SHARED',role:'EDITOR'},'INITIALIZE_JOURNAL','','','schema 2');return {ready:true,backupId:backup.getId(),fileBackupId:storageBackup.getId()};
  }finally{lock.releaseLock();}
});}
function jSaveFile_(s,actor,file,type,version,visibility,assignment){
  if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>250||typeof file.base64!=='string'||!file.base64.length||file.base64.length>20971520||file.base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))throw userError_('ข้อมูลไฟล์ไม่ถูกต้องหรือมีขนาดเกิน 15 MB');
  var ext=file.name.split('.').pop().toLowerCase(),allowed=type.indexOf('WORD')>=0?['docx']:type.indexOf('PDF')>=0?['pdf']:type==='COVER'?['png','jpg','jpeg']:['docx','pdf'];if(allowed.indexOf(ext)<0)throw userError_('ประเภทไฟล์ไม่ถูกต้อง');
  var bytes=Utilities.base64Decode(file.base64);if(!bytes.length||bytes.length>15*1024*1024)throw userError_('ไฟล์ว่างหรือมีขนาดเกิน 15 MB');
  // File signatures must agree with extension; this is not an antivirus scan.
  var head=bytes.slice(0,5).map(function(b){return String.fromCharCode((b+256)%256);}).join('');
  if(ext==='pdf'&&head!=='%PDF-'||ext==='docx'&&head.slice(0,2)!=='PK'||ext==='png'&&(bytes[0]+256)%256!==137||['jpg','jpeg'].indexOf(ext)>=0&&(bytes[0]+256)%256!==255)throw userError_('เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์');
  var folder=DriveApp.getFolderById(requiredProperty_('ROOT_FOLDER_ID')),id=jUuid_();if(s){folder=childFolder_(childFolder_(folder,s.manuscript_id.split('-')[1]),s.manuscript_id);var stage=visibility==='REVIEWER'?'02_Review':type.indexOf('REVISION')===0?'03_Revision':type.indexOf('FINAL')===0?'05_Proof':type==='LETTER'?'04_Accepted':'02_Review';folder=childFolder_(childFolder_(folder,stage),'v'+version);}
  folder.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);var stored=(s?s.manuscript_id:'STJ')+'_v'+version+'_'+type+'_'+id+'.'+ext,mime=ext==='pdf'?'application/pdf':ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':ext==='png'?'image/png':'image/jpeg';
  var f=folder.createFile(Utilities.newBlob(bytes,mime,stored));f.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
  jAppend_('FILES',{file_id:id,manuscript_id:s?s.manuscript_id:'',version:version,file_type:type,original_name:clean_(file.name,250),stored_name:stored,storage_id:f.getId(),uploaded_by:actor.id,uploaded_at:jNow_(),visibility:visibility,assignment_id:assignment||'',checksum:Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('')});return id;
}
function jFileView_(f,blind){return {fileId:f.file_id,name:blind?f.stored_name:f.original_name,type:f.file_type,version:Number(f.version)};}
function getAuthorizedFile(q){return response_(function(){jReady_();var f=jFind_('FILES','file_id',q.fileId);if(!f)throw userError_('ไม่พบไฟล์');var authorized=false;
  if(f.visibility==='PUBLIC')authorized=f.file_type==='COVER'?jRows_('ISSUES').some(function(i){return i.cover_file_id===f.file_id&&i.status==='Published';}):jRows_('PUBLICATIONS').some(function(p){return p.pdf_file_id===f.file_id&&jFind_('ISSUES','issue_id',p.issue_id).status==='Published';});
  if(!authorized){try{jActor_(q,'EDITOR');authorized=true;}catch(e){} }
  if(!authorized&&f.manuscript_id){try{var a=jActor_(q,'AUTHOR');jOwner_(a.id,f.manuscript_id);authorized=f.visibility==='AUTHOR';}catch(e){} }
  if(!authorized&&f.visibility==='REVIEWER'){try{var a=jActor_(q,'REVIEWER');authorized=jRows_('REVIEW_ASSIGNMENTS').some(function(r){return r.reviewer_id===a.id&&!r.cancelled_at&&r.invitation_status==='Accepted'&&r.blind_file_id===f.file_id;});}catch(e){} }
  if(!authorized){try{jActor_(q,'PROOFREADER');var ps=f.manuscript_id&&jManuscript_(f.manuscript_id);if(ps)jProductionRight_(jActor_(q,'PROOFREADER'),ps);authorized=ps&&!!jMeta_(ps).accepted_at&&f.visibility==='AUTHOR';}catch(e){} }
  if(!authorized)throw userError_('ไม่มีสิทธิ์ดาวน์โหลดไฟล์');var blob=DriveApp.getFileById(f.storage_id).getBlob();return {name:f.stored_name,mime:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes())};
});}
function getJournalLogs(q){return jRead_(q,'EDITOR',function(){return {audit:jRows_('AUDIT_LOG').slice(-100).reverse(),notifications:jRows_('NOTIFICATIONS').slice(-100).reverse(),operations:jRows_('OPERATIONS').filter(function(o){return o.state!=='COMPLETE';})};});}
function jRegisterOriginals_(s){['word_file_id','pdf_file_id','certificate_file_id','ai_disclosure_file_id','ethics_file_id'].forEach(function(key){if(!s[key]||jRows_('FILES').some(function(f){return f.storage_id===s[key];}))return;var f=DriveApp.getFileById(s[key]);f.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);jAppend_('FILES',{file_id:jUuid_(),manuscript_id:s.manuscript_id,version:1,file_type:key.toUpperCase(),original_name:f.getName(),stored_name:f.getName(),storage_id:s[key],uploaded_by:'LEGACY_AUTHOR',uploaded_at:s.submitted_at,visibility:'AUTHOR'});});}
function jChangeStatus_(q){return jWrite_(q,'CHANGE_STATUS','EDITOR',function(actor,tx){var s=jManuscript_(q.manuscriptId),to=jCanonical_(q.status);jBeforeStatus_(s,to,q);tx.start();jTransition_(s,to,actor,q.publicNote,q.privateNote);jAuthorMail_(s,to,q.publicNote,'status:'+s.manuscript_id+':'+q.operationId);return {manuscriptId:s.manuscript_id,status:to,statusLabel:journalStates_()[to]};});}
function listStaffRoles(q){return jRead_(q,'EDITOR',function(){return {users:rows_('USERS').map(function(u){return {userId:u.user_id,name:u.display_name,username:u.username};}),roles:jRows_('USER_ROLES'),assignments:jRows_('PRODUCTION_ASSIGNMENTS')};});}
function grantStaffRole(q){return jWrite_(q,'GRANT_ROLE','EDITOR',function(actor,tx){if(['EDITOR','MANAGING_EDITOR','PROOFREADER','ADMIN','AUTHOR'].indexOf(q.role)<0||!rows_('USERS').some(function(u){return u.user_id===q.userId;}))throw userError_('บัญชีหรือบทบาทไม่ถูกต้อง');tx.start();var r=jRows_('USER_ROLES').find(function(r){return r.user_id===q.userId&&r.role===q.role;}),data={user_id:q.userId,role:q.role,active:q.active!==false};if(r)jUpdate_('USER_ROLES',r._row,data);else jAppend_('USER_ROLES',data);if(q.manuscriptId&&q.role==='PROOFREADER'){var s=jManuscript_(q.manuscriptId);if(!jMeta_(s).accepted_at)throw userError_('มอบหมายตรวจภาษาได้เฉพาะบทความตอบรับ');jAppend_('PRODUCTION_ASSIGNMENTS',{manuscript_id:s.manuscript_id,user_id:q.userId,assigned_at:jNow_()});}return {saved:true};});}
function jProductionRight_(actor,s){if(actor.role==='EDITOR')return;if(!jRows_('PRODUCTION_ASSIGNMENTS').some(function(a){return a.user_id===actor.id&&a.manuscript_id===s.manuscript_id;}))throw userError_('งานตรวจภาษานี้ไม่ได้มอบหมายให้ท่าน');}
function getJournalOverview(q){return jRead_(q,'EDITOR',function(){var authors=rows_('AUTHORS'),assign=jRows_('REVIEW_ASSIGNMENTS'),issues=jRows_('ISSUE_ARTICLES'),states=journalStates_(),list=rows_('SUBMISSIONS').map(function(s){var a=authors.find(function(a){return a.manuscript_id===s.manuscript_id&&String(a.is_corresponding)==='true';}),reviews=assign.filter(function(a){return a.manuscript_id===s.manuscript_id&&!a.cancelled_at&&a.invitation_status!=='Declined';}),round=reviews.reduce(function(n,r){return Math.max(n,Number(r.round));},0),current=reviews.filter(function(a){return Number(a.round)===round;});return {manuscriptId:s.manuscript_id,title:s.title_th,author:a?a.name_th:'',department:s.department,type:s.article_type,submittedAt:s.submitted_at,status:jCanonical_(s.status),statusLabel:states[jCanonical_(s.status)]||s.status,reviewComplete:current.length>=2&&current.every(function(a){return a.review_status==='Completed';})};});var counts={ALL:list.length,REVIEW_COMPLETE:list.filter(function(r){return r.reviewComplete;}).length};Object.keys(states).filter(function(s){return s===jCanonical_(s);}).forEach(function(status){counts[status]=list.filter(function(s){return s.status===status;}).length;});return {counts:counts,states:states,rows:list.filter(function(s){return (!q.status||s.status===q.status)&&(!q.type||s.type===q.type)&&(!q.department||s.department.toLowerCase().includes(String(q.department).toLowerCase()))&&(!q.author||s.author.toLowerCase().includes(String(q.author).toLowerCase()))&&(!q.fromDate||new Date(s.submittedAt)>=new Date(q.fromDate+'T00:00:00+07:00'))&&(!q.toDate||new Date(s.submittedAt)<=new Date(q.toDate+'T23:59:59+07:00'))&&(!q.reviewerId||assign.some(function(a){return a.manuscript_id===s.manuscriptId&&a.reviewer_id===q.reviewerId;}))&&(!q.issueId||issues.some(function(a){return a.manuscript_id===s.manuscriptId&&a.issue_id===q.issueId;}));}).slice(-300).reverse()};});}



function jValidateUpload_(file,type){
  if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>250||typeof file.base64!=='string'||!file.base64.length||file.base64.length>20971520||file.base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))throw userError_('ข้อมูลไฟล์ไม่ถูกต้องหรือมีขนาดเกิน 15 MB');
  var ext=file.name.split('.').pop().toLowerCase(),allowed=type.indexOf('WORD')>=0?['docx']:type.indexOf('PDF')>=0?['pdf']:type==='COVER'?['png','jpg','jpeg']:['docx','pdf'];if(allowed.indexOf(ext)<0)throw userError_('ประเภทไฟล์ไม่ถูกต้อง');
  var bytes=Utilities.base64Decode(file.base64);if(!bytes.length||bytes.length>15*1024*1024)throw userError_('ไฟล์ว่างหรือมีขนาดเกิน 15 MB');
  // File signatures must agree with extension; this is not an antivirus scan.
  var head=bytes.slice(0,5).map(function(b){return String.fromCharCode((b+256)%256);}).join('');
  if(ext==='pdf'&&head!=='%PDF-'||ext==='docx'&&head.slice(0,2)!=='PK'||ext==='png'&&(bytes[0]+256)%256!==137||['jpg','jpeg'].indexOf(ext)>=0&&(bytes[0]+256)%256!==255)throw userError_('เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์');

return true;}
