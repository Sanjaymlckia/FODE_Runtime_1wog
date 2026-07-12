const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const file = 'prototypes/operator-next/operator-next-prototype.html';
const source = fs.readFileSync(file, 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/);

assert(script, 'prototype must contain an inline script');
new vm.Script(script[1], { filename: file });

[
  'Operator Next',
  'Lifecycle Map',
  'Operational Dashboard',
  'Applicant Action',
  'Admissions Review',
  'Communications',
  'Payment Follow-up',
  'Payment Review',
  'Portal Operations',
  'Contactability & Manual WhatsApp Support',
  'Registry & Classroom Handover',
  'Exceptions & Hidden Records',
  'System Health',
  'Roles & Capabilities',
  'Review Workspace',
  'Batch Communication',
  'Communication Authority',
  'Technical diagnostics',
  'Export selected VCF',
  'Future: batch approval workflow',
].forEach((marker) => assert(source.includes(marker), `missing marker: ${marker}`));

assert(source.toLowerCase().includes('no network'), 'prototype must disclose its no-network boundary');
assert(!source.includes('google.script.run'), 'prototype must not bind Apps Script');
assert(!source.includes('fetch('), 'prototype must not make fetch requests');
assert(!source.includes('XMLHttpRequest'), 'prototype must not make XHR requests');
assert(source.includes('@media(max-width:820px)'), 'prototype must include laptop/narrow responsiveness');
assert(source.includes('@media(max-width:560px)'), 'prototype must include mobile responsiveness');
assert(source.includes('grid-template-columns:218px'), 'prototype must preserve the measured OPS sidebar width');
assert(source.includes('width:174px;min-height:214px'), 'lifecycle cards must remain narrow and deep');
assert(source.includes("isContact?!!r.phone:r.selectable"), 'VCF selection must use phone readiness without changing mail selectability');
assert(source.includes("a.phone&&selected.has(a.id)"), 'VCF export must remain scoped to selected contactability rows');

[
  'route-lifecycle',
  'route-dashboard',
  'route-applicant-action',
  'route-admissions',
  'route-communications',
  'route-finance',
  'route-portal',
  'route-contactability',
  'route-registry',
  'route-exceptions',
  'route-system-health',
  'route-roles',
].forEach((route) => assert(source.includes(`id="${route}"`), `missing navigable route: ${route}`));

console.log('PASS operator-next prototype source contract');
