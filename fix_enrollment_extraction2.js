const fs = require('fs');
const path = require('path');

const ssFile = path.join(__dirname, 'modules/student/services/StudentApplicationService.js');
const esFile = path.join(__dirname, 'modules/enrollment/services/EnrollmentApplicationService.js');

let esCode = fs.readFileSync(esFile, 'utf8');
const lines = esCode.split('\n');

const assignTeacherIdx = lines.findIndex(l => l.includes('async put_id_assign_teacher(data)'));

if (assignTeacherIdx !== -1) {
  // Extract lines from assignTeacherIdx to the end (excluding the last closing brace of EnrollmentApplicationService)
  let toMove = lines.slice(assignTeacherIdx, lines.length - 2).join('\n'); // assuming `}\nmodule.exports...` at end
  
  // Clean up EnrollmentApplicationService.js
  let newEsCode = lines.slice(0, assignTeacherIdx).join('\n');
  newEsCode += '\n}\n\nmodule.exports = new EnrollmentApplicationService();\n';
  fs.writeFileSync(esFile, newEsCode);
  
  // Append back to StudentApplicationService.js
  let ssCode = fs.readFileSync(ssFile, 'utf8');
  // insert before the last closing brace
  const lastBraceIdx = ssCode.lastIndexOf('}');
  const newSsCode = ssCode.slice(0, lastBraceIdx) + toMove + '\n' + ssCode.slice(lastBraceIdx);
  fs.writeFileSync(ssFile, newSsCode);
  
  console.log('✅ Restored methods back to StudentApplicationService.js');
} else {
  console.log('❌ Could not find put_id_assign_teacher in EnrollmentApplicationService.js');
}
