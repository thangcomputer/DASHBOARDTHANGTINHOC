const fs = require('fs');
const path = require('path');

const domainModels = {
  finance: ['CreditNote', 'FinanceDailySnapshot', 'LedgerEntry', 'PayrollLog'],
  invoice: ['Invoice'],
  payment: ['PaymentSession', 'SepayWebhookEvent'],
  transaction: ['Transaction']
};

for (const [domain, models] of Object.entries(domainModels)) {
  const repoDir = path.join(__dirname, `modules/${domain}/repositories`);
  if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });

  let indexContent = '';

  models.forEach(m => {
    // Keep names granular per ARB rule: LedgerRepository, PayrollRepository, etc. 
    // Except FinanceDailySnapshot which is a bit long, but we'll stick to model + Repository format
    let baseName = m;
    if (m === 'LedgerEntry') baseName = 'Ledger';
    if (m === 'PayrollLog') baseName = 'Payroll';
    
    const repoName = baseName + 'Repository';
    const mongoName = 'Mongo' + repoName;
    
    // Interface
    fs.writeFileSync(path.join(repoDir, repoName + '.js'), `const BaseRepository = require('../../../shared/repositories/BaseRepository');\n\nclass ${repoName} extends BaseRepository {\n}\n\nmodule.exports = ${repoName};\n`);
    
    // Impl
    fs.writeFileSync(path.join(repoDir, mongoName + '.js'), `const ${repoName} = require('./${repoName}');\nconst ${m} = require('../models/${m}');\n\nclass ${mongoName} extends ${repoName} {\n  constructor() {\n    super(${m});\n  }\n}\n\nmodule.exports = ${mongoName};\n`);
    
    indexContent += `const ${mongoName} = require('./${mongoName}');\n`;
  });

  indexContent += '\nmodule.exports = {\n';
  models.forEach(m => {
    let baseName = m;
    if (m === 'LedgerEntry') baseName = 'Ledger';
    if (m === 'PayrollLog') baseName = 'Payroll';
    
    const camelName = baseName.charAt(0).toLowerCase() + baseName.slice(1) + 'Repository';
    const mongoName = 'Mongo' + baseName + 'Repository';
    indexContent += `  ${camelName}: new ${mongoName}(),\n`;
  });
  indexContent += '};\n';

  fs.writeFileSync(path.join(repoDir, 'index.js'), indexContent);
}

console.log('Generated Finance Repositories');
