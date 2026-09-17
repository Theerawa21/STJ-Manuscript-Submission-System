var STJ_STATUSES_ = {SUBMITTED:'รับบทความแล้ว',CHECKING:'ตรวจสอบเอกสาร',SCREENING:'กลั่นกรองเบื้องต้น',REVIEW:'อยู่ระหว่าง Peer Review',REVISION:'รอผู้เขียนแก้ไข',RECHECK:'ตรวจฉบับแก้ไข',ACCEPTED:'ตอบรับบทความ',PROOFREAD:'ตรวจภาษาและพิสูจน์อักษร',LAYOUT:'จัดรูปแบบ',PUBLISHED:'เผยแพร่แล้ว',REJECTED:'ไม่รับพิจารณา'};
var STJ_TYPES_ = ['RESEARCH','ACADEMIC','INNOVATION','STUDENT_PROJECT'];
var STJ_ROLES_ = ['TEACHER','STAFF','STUDENT'];

function buddhistYear_(date) { return date.getFullYear() + 543; }
function formatManuscriptId_(year, sequence) { return 'STJ-' + year + '-' + String(sequence).padStart(3, '0'); }
function normalizeId_(value) { return String(value == null ? '' : value).trim().toUpperCase().replace(/\s/g, ''); }
function normalizeEmail_(value) { return String(value == null ? '' : value).trim().toLowerCase(); }
function clean_(value, max) { return String(value == null ? '' : value).trim().replace(/[\u0000-\u001f]/g, ' ').slice(0, max || 5000); }
function safeCell_(value) { if (value instanceof Date) return value; var s = String(value == null ? '' : value); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function userError_(message) { var error = new Error(message); error.publicMessage = message; return error; }

function validateSubmissionData_(data) {
  if (!data) throw userError_('ไม่พบข้อมูลแบบฟอร์ม');
  ['title_th','title_en','article_type','department','keywords_th','keywords_en','work_origin'].forEach(function (key) {
    if (!clean_(data[key])) throw userError_('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
  });
  if (STJ_TYPES_.indexOf(clean_(data.article_type)) < 0) throw userError_('ประเภทบทความไม่ถูกต้อง');
  var authors = data.authors;
  if (!Array.isArray(authors) || !authors.length) throw userError_('กรุณากรอกข้อมูลผู้เขียนหลัก');
  authors.forEach(function (author, index) {
    if (!clean_(author.name_th) || !clean_(author.name_en) || STJ_ROLES_.indexOf(clean_(author.role)) < 0) throw userError_('ข้อมูลผู้เขียนลำดับที่ ' + (index + 1) + ' ไม่ครบ');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail_(author.email))) throw userError_('อีเมลผู้เขียนลำดับที่ ' + (index + 1) + ' ไม่ถูกต้อง');
    if (!clean_(author.phone)) throw userError_('กรุณากรอกโทรศัพท์ผู้เขียนลำดับที่ ' + (index + 1));
    if (author.role === 'STUDENT' && (!clean_(author.grade_level) || !clean_(author.advisor_name))) throw userError_('กรุณากรอกชั้นเรียนและครูที่ปรึกษาของนักเรียน');
  });
  if (String(data.under_consideration_elsewhere) === 'true') throw userError_('ไม่สามารถส่งบทความที่อยู่ระหว่างการพิจารณาของวารสารอื่น');
  ['certify_correct','certify_exclusive','consent_review','accept_ethics'].forEach(function (key) { if (data[key] !== true && data[key] !== 'true' && data[key] !== 'on') throw userError_('กรุณายอมรับคำรับรองทั้งหมด'); });
  return authors;
}

function publicTrackingView_(submission, timeline) {
  return {manuscriptId:String(submission.manuscript_id),title:String(submission.title_th),status:String(submission.status),statusLabel:STJ_STATUSES_[String(submission.status)] || String(submission.status),submittedAt:submission.submitted_at,publicNote:clean_(submission.public_note,2000),timeline:(timeline || []).map(function (row) { return {at:row.changed_at,status:String(row.to_status),label:STJ_STATUSES_[String(row.to_status)] || String(row.to_status),note:clean_(row.public_note,2000)}; })};
}
