const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('backend/apps-script/Core.gs', 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('converts Gregorian date to Buddhist Era year', () => {
  assert.equal(context.buddhistYear_(new Date('2027-01-15T00:00:00Z')), 2570);
});

test('formats manuscript sequence with three digits', () => {
  assert.equal(context.formatManuscriptId_(2570, 7), 'STJ-2570-007');
});

test('normalizes manuscript id and author email', () => {
  assert.equal(context.normalizeId_(' stj-2570-007 '), 'STJ-2570-007');
  assert.equal(context.normalizeEmail_(' Editor@Example.COM '), 'editor@example.com');
});

test('prevents spreadsheet formula injection', () => {
  assert.equal(context.safeCell_('=IMPORTXML("x")'), "'=IMPORTXML(\"x\")");
  assert.equal(context.safeCell_('+123'), "'+123");
  assert.equal(context.safeCell_('ordinary'), 'ordinary');
});

test('rejects concurrent submission', () => {
  assert.throws(() => context.validateSubmissionData_({
    title_th:'หัวข้อ', title_en:'Title', article_type:'RESEARCH', department:'Science',
    keywords_th:'คำสำคัญ', keywords_en:'keyword', work_origin:'งานวิจัย',
    under_consideration_elsewhere:'true', authors:[{name_th:'ก',name_en:'A',role:'TEACHER',email:'a@example.com',phone:'1'}],
    certify_correct:true, certify_exclusive:true, consent_review:true, accept_ethics:true
  }), /ระหว่างการพิจารณา/);
});

test('accepts a complete basic submission', () => {
  const authors = context.validateSubmissionData_({
    title_th:'หัวข้อ', title_en:'Title', article_type:'RESEARCH', department:'Science',
    keywords_th:'คำสำคัญ', keywords_en:'keyword', work_origin:'งานวิจัย',
    under_consideration_elsewhere:'false', authors:[{name_th:'ก',name_en:'A',role:'TEACHER',email:'a@example.com',phone:'1'}],
    certify_correct:true, certify_exclusive:true, consent_review:true, accept_ethics:true
  });
  assert.equal(authors.length, 1);
});

test('public tracking projection omits private fields', () => {
  const view = context.publicTrackingView_({manuscript_id:'STJ-2570-001',title_th:'หัวข้อ',status:'SUBMITTED',submitted_at:'now',public_note:'รับแล้ว',private_note:'ลับ',drive_folder_id:'secret'}, []);
  assert.equal(view.manuscriptId, 'STJ-2570-001');
  assert.equal(Object.hasOwn(view, 'private_note'), false);
  assert.equal(Object.hasOwn(view, 'drive_folder_id'), false);
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log('PASS', t.name); }
  catch (e) { failed++; console.error('FAIL', t.name, '\n ', e.message); }
}
if (failed) process.exit(1);
console.log(`PASS ${tests.length} tests`);
