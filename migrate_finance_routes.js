const fs = require('fs');
const path = require('path');

const domainModels = {
  finance: ['CreditNote', 'FinanceDailySnapshot', 'LedgerEntry', 'PayrollLog'],
  invoice: ['Invoice'],
  payment: ['PaymentSession', 'SepayWebhookEvent'],
  transaction: ['Transaction']
};

for (const [domain, models] of Object.entries(domainModels)) {
  const routesDir = path.join(__dirname, `modules/${domain}/routes`);
  if (fs.existsSync(routesDir)) {
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
    routeFiles.forEach(file => {
      migrateFile(path.join(routesDir, file), domain, models);
    });
  }

  const servicesDir = path.join(__dirname, `modules/${domain}/services`);
  if (fs.existsSync(servicesDir)) {
    const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'));
    serviceFiles.forEach(file => {
      migrateFile(path.join(servicesDir, file), domain, models);
    });
  }
}

function migrateFile(filePath, domain, models) {
  let content = fs.readFileSync(filePath, 'utf8');

  models.forEach(m => {
    let baseName = m;
    if (m === 'LedgerEntry') baseName = 'Ledger';
    if (m === 'PayrollLog') baseName = 'Payroll';
    
    const camelName = baseName.charAt(0).toLowerCase() + baseName.slice(1) + 'Repository';

    content = content.replace(
      new RegExp(`const ${m}\\s*=\\s*require\\('\\.\\./models/${m}'\\);`, 'g'),
      `const { ${camelName} } = require('../repositories');\nconst ${m} = require('../models/${m}'); // Temp for new ${m}`
    );
    
    // Some are imported differently
    content = content.replace(
      new RegExp(`const ${m}\\s*=\\s*require\\('\\.\\./\\.\\./${domain}/models/${m}'\\);`, 'g'),
      `const { ${camelName} } = require('../../${domain}/repositories');\nconst ${m} = require('../../${domain}/models/${m}'); // Temp for new ${m}`
    );

    const replacements = [
      { from: new RegExp(`${m}\\.countDocuments\\(`, 'g'), to: `${camelName}.count(` },
      { from: new RegExp(`${m}\\.find\\(`, 'g'), to: `${camelName}.findMany(` },
      { from: new RegExp(`${m}\\.findById\\(`, 'g'), to: `${camelName}.findById(` },
      { from: new RegExp(`${m}\\.findOne\\(`, 'g'), to: `${camelName}.findOne(` },
      { from: new RegExp(`${m}\\.create\\(`, 'g'), to: `${camelName}.create(` },
      { from: new RegExp(`${m}\\.insertMany\\(`, 'g'), to: `${camelName}.insertMany(` },
      { from: new RegExp(`${m}\\.findByIdAndUpdate\\(`, 'g'), to: `${camelName}.updateById(` },
      { from: new RegExp(`${m}\\.findOneAndUpdate\\(`, 'g'), to: `${camelName}.updateOne(` },
      { from: new RegExp(`${m}\\.findByIdAndDelete\\(`, 'g'), to: `${camelName}.deleteById(` },
      { from: new RegExp(`${m}\\.findOneAndDelete\\(`, 'g'), to: `${camelName}.deleteOne(` },
      { from: new RegExp(`${m}\\.updateMany\\(`, 'g'), to: `${camelName}.updateMany(` },
      { from: new RegExp(`new ${m}\\(`, 'g'), to: `${camelName}.createInstance(` },
    ];

    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
  });

  fs.writeFileSync(filePath, content, 'utf8');
}

// Special case for ledgerService.js aggregations
const ledgerServicePath = path.join(__dirname, 'modules/finance/services/ledgerService.js');
if (fs.existsSync(ledgerServicePath)) {
  let content = fs.readFileSync(ledgerServicePath, 'utf8');
  
  // Replace aggregateTotalsByType
  content = content.replace(
    /const rows = await ledgerRepository\.aggregate\(\[\s*{\s*\$match:\s*match\s*}\s*,\s*{\s*\$group:\s*{\s*_id:\s*'\$type',\s*total:\s*{\s*\$sum:\s*'\$amount'\s*},\s*count:\s*{\s*\$sum:\s*1\s*}\s*,\s*}\s*,\s*}\s*,\s*\]\);/g,
    "const rows = await ledgerRepository.aggregateTotalsByType(match);"
  );

  // Replace aggregateInvoiceTotals
  content = content.replace(
    /const invAgg = await invoiceRepository\.aggregate\(\[\s*{\s*\$match:\s*invMatch\s*}\s*,\s*{\s*\$group:\s*{\s*_id:\s*null,\s*total:\s*{\s*\$sum:\s*'\$hocPhi'\s*},\s*count:\s*{\s*\$sum:\s*1\s*}\s*,\s*}\s*,\s*}\s*,\s*\]\);/g,
    "const invAgg = await invoiceRepository.aggregateInvoiceTotals(invMatch);"
  );
  
  // Replace aggregateTotalsByDateAndBranch
  content = content.replace(
    /const rows = await ledgerRepository\.aggregate\(\[\s*{\s*\$match:\s*match\s*}\s*,\s*{\s*\$group:\s*{\s*_id:\s*{\s*dateKey:\s*{\s*\$dateToString:\s*{\s*format:\s*'%Y-%m-%d',\s*date:\s*'\$postedAt'\s*}\s*},\s*branchId:\s*'\$branchId',\s*type:\s*'\$type',\s*}\s*,\s*total:\s*{\s*\$sum:\s*'\$amount'\s*},\s*count:\s*{\s*\$sum:\s*1\s*}\s*,\s*}\s*,\s*}\s*,\s*\]\);/g,
    "const rows = await ledgerRepository.aggregateTotalsByDateAndBranch(match);"
  );

  // Replace aggregateRevenueByCourse
  content = content.replace(
    /return ledgerRepository\.aggregate\(\[\s*{\s*\$match:\s*match\s*}\s*,\s*{\s*\$group:\s*{\s*_id:\s*{\s*\$ifNull:\s*\['\$courseName',\s*'Khác'\]\s*},\s*payments:\s*{\s*\$sum:\s*{\s*\$cond:\s*\[{\s*\$eq:\s*\['\$type',\s*'payment'\]\s*},\s*'\$amount',\s*0\]\s*}\s*,\s*},\s*refunds:\s*{\s*\$sum:\s*{\s*\$cond:\s*\[{\s*\$eq:\s*\['\$type',\s*'refund'\]\s*},\s*'\$amount',\s*0\]\s*}\s*,\s*},\s*paymentCount:\s*{\s*\$sum:\s*{\s*\$cond:\s*\[{\s*\$eq:\s*\['\$type',\s*'payment'\]\s*},\s*1,\s*0\]\s*}\s*,\s*},\s*}\s*,\s*}\s*,\s*{\s*\$project:\s*{\s*_id:\s*0,\s*course:\s*'\$_id',\s*count:\s*'\$paymentCount',\s*revenue:\s*{\s*\$subtract:\s*\['\$payments',\s*'\$refunds'\]\s*}\s*,\s*}\s*,\s*}\s*,\s*{\s*\$sort:\s*{\s*revenue:\s*-1\s*}\s*},\s*{\s*\$limit:\s*Math\.max\(1,\s*Number\(limit\)\s*\|\|\s*8\)\s*},\s*\]\);/g,
    "return ledgerRepository.aggregateRevenueByCourse(match, limit);"
  );

  // Replace aggregateNetRevenueByDay
  content = content.replace(
    /return ledgerRepository\.aggregate\(\[\s*{\s*\$match:\s*match\s*}\s*,\s*{\s*\$group:\s*{\s*_id:\s*{\s*\$dateToString:\s*{\s*format:\s*'%Y-%m-%d',\s*date:\s*'\$postedAt'\s*}\s*},\s*payments:\s*{\s*\$sum:\s*{\s*\$cond:\s*\[{\s*\$eq:\s*\['\$type',\s*'payment'\]\s*},\s*'\$amount',\s*0\]\s*}\s*,\s*},\s*refunds:\s*{\s*\$sum:\s*{\s*\$cond:\s*\[{\s*\$eq:\s*\['\$type',\s*'refund'\]\s*},\s*'\$amount',\s*0\]\s*}\s*,\s*},\s*}\s*,\s*}\s*,\s*{\s*\$project:\s*{\s*_id:\s*0,\s*date:\s*'\$_id',\s*revenue:\s*{\s*\$subtract:\s*\['\$payments',\s*'\$refunds'\]\s*}\s*,\s*}\s*,\s*}\s*,\s*{\s*\$sort:\s*{\s*date:\s*1\s*}\s*},\s*\]\);/g,
    "return ledgerRepository.aggregateNetRevenueByDay(match);"
  );
  
  // Clean up any remaining .aggregate that didn't match the regex due to formatting
  content = content.replace(/LedgerEntry\.aggregate\(/g, "ledgerRepository.aggregateTotalsByType("); // Just in case, manual replace later if needed

  fs.writeFileSync(ledgerServicePath, content, 'utf8');
}

console.log('Migrated Finance Services/Routes');
