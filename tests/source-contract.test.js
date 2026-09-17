const fs = require('fs');
const assert = require('assert');

const code = fs.readFileSync('backend/apps-script/Code.gs', 'utf8');
const html = fs.readFileSync('backend/apps-script/Index.html', 'utf8');

for (const name of ['doGet','setupSystem','setEditorialPassword_','submitManuscript','trackManuscript','editorLogin','getDashboard','getSubmissionDetail','updateSubmissionStatus']) {
  assert.match(code, new RegExp('function\\s+' + name + '\\s*\\('), `missing server entry point ${name}`);
}

for (const sheet of ['SUBMISSIONS','AUTHORS','STATUS_LOG','SETTINGS','REVIEWERS','REVIEWS']) {
  assert.ok(code.includes(sheet), `missing sheet ${sheet}`);
}

for (const label of ['ส่งบทความใหม่','ตรวจสอบสถานะบทความ','กองบรรณาธิการ','authors_json','word_file','pdf_file']) {
  assert.ok(html.includes(label), `missing interface contract ${label}`);
}

assert.ok(html.includes('google.script.run'), 'client must use google.script.run');
assert.ok(html.includes('localStorage'), 'wizard must save a browser draft');
assert.match(code, /function\s+doGet\s*\([^)]*\)\s*\{[^}]*setupSystem\(\)/s, 'web app entry must initialize the database idempotently');
console.log('PASS source contract');

