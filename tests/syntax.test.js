const fs = require('fs');
const vm = require('vm');

for (const file of ['backend/apps-script/Core.gs','backend/apps-script/Code.gs','backend/apps-script/AuthorAccounts.gs']) {
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
  console.log('PASS syntax', file);
}

const html = fs.readFileSync('backend/apps-script/Index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) throw new Error('No inline script found');
scripts.forEach((source, index) => new vm.Script(source, { filename: `Index-inline-${index}.js` }));
console.log('PASS syntax backend/apps-script/Index.html inline scripts');
