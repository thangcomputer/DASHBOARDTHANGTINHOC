const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const EXCLUDED_DIRS = ['node_modules', 'client', '.git', 'dist'];

const DOMAINS = ['finance', 'payment', 'invoice', 'transaction', 'exam', 'certificate', 'analytics', 'report'];
const FOLDERS = [
  'controllers', 'services', 'repositories', 'routes', 'models',
  'validators', 'dto', 'events', 'tests'
];

const MOVES = [
  // Invoice
  { src: 'routes/invoiceRoutes.js', dest: 'modules/invoice/routes/invoiceRoutes.js' },
  { src: 'models/Invoice.js', dest: 'modules/invoice/models/Invoice.js' },
  
  // Transaction
  { src: 'routes/transactionRoutes.js', dest: 'modules/transaction/routes/transactionRoutes.js' },
  { src: 'models/Transaction.js', dest: 'modules/transaction/models/Transaction.js' },
  
  // Finance
  { src: 'routes/financeRoutes.js', dest: 'modules/finance/routes/financeRoutes.js' },
  { src: 'routes/biRoutes.js', dest: 'modules/finance/routes/biRoutes.js' },
  { src: 'models/LedgerEntry.js', dest: 'modules/finance/models/LedgerEntry.js' },
  { src: 'models/CreditNote.js', dest: 'modules/finance/models/CreditNote.js' },
  { src: 'models/FinanceDailySnapshot.js', dest: 'modules/finance/models/FinanceDailySnapshot.js' },
  { src: 'models/PayrollLog.js', dest: 'modules/finance/models/PayrollLog.js' },
  { src: 'services/ledgerService.js', dest: 'modules/finance/services/ledgerService.js' },
  { src: 'services/revenueAggregate.js', dest: 'modules/finance/services/revenueAggregate.js' },
  { src: 'services/biService.js', dest: 'modules/finance/services/biService.js' },
  
  // Payment
  { src: 'routes/webhookRoutes.js', dest: 'modules/payment/routes/webhookRoutes.js' },
  { src: 'models/PaymentSession.js', dest: 'modules/payment/models/PaymentSession.js' },
  { src: 'models/SepayWebhookEvent.js', dest: 'modules/payment/models/SepayWebhookEvent.js' },
  
  // Exam
  { src: 'routes/examResultRoutes.js', dest: 'modules/exam/routes/examResultRoutes.js' },
  { src: 'routes/proctorRoutes.js', dest: 'modules/exam/routes/proctorRoutes.js' },
  { src: 'routes/quizRoutes.js', dest: 'modules/exam/routes/quizRoutes.js' },
  { src: 'routes/evaluationRoutes.js', dest: 'modules/exam/routes/evaluationRoutes.js' },
  { src: 'models/ExamResult.js', dest: 'modules/exam/models/ExamResult.js' },
  { src: 'models/ProctorEvent.js', dest: 'modules/exam/models/ProctorEvent.js' },
  { src: 'models/LessonQuiz.js', dest: 'modules/exam/models/LessonQuiz.js' },
  { src: 'models/Evaluation.js', dest: 'modules/exam/models/Evaluation.js' },
  { src: 'services/examProgressService.js', dest: 'modules/exam/services/examProgressService.js' },
  { src: 'services/examSubjectCatalog.js', dest: 'modules/exam/services/examSubjectCatalog.js' },
  { src: 'services/proctorAuditService.js', dest: 'modules/exam/services/proctorAuditService.js' },
  
  // Analytics
  { src: 'routes/analyticsRoutes.js', dest: 'modules/analytics/routes/analyticsRoutes.js' },
  
  // Report
  { src: 'routes/monitoringRoutes.js', dest: 'modules/report/routes/monitoringRoutes.js' },
  { src: 'routes/systemLogRoutes.js', dest: 'modules/report/routes/systemLogRoutes.js' },
  { src: 'routes/backupRoutes.js', dest: 'modules/report/routes/backupRoutes.js' },
  { src: 'models/ReportDefinition.js', dest: 'modules/report/models/ReportDefinition.js' },
  { src: 'models/SystemLog.js', dest: 'modules/report/models/SystemLog.js' },
  { src: 'models/AuditLog.js', dest: 'modules/report/models/AuditLog.js' },
  { src: 'models/BackupJob.js', dest: 'modules/report/models/BackupJob.js' },
  { src: 'services/reportService.js', dest: 'modules/report/services/reportService.js' },
  { src: 'services/monitoringService.js', dest: 'modules/report/services/monitoringService.js' },
  { src: 'services/backupService.js', dest: 'modules/report/services/backupService.js' },
  { src: 'services/metricsCollector.js', dest: 'modules/report/services/metricsCollector.js' },
  { src: 'services/auditLogService.js', dest: 'modules/report/services/auditLogService.js' }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. Create structure
DOMAINS.forEach(domain => {
  const domainDir = path.join(ROOT_DIR, 'modules', domain);
  ensureDir(domainDir);
  
  // Create index.js
  const indexFile = path.join(domainDir, 'index.js');
  if (!fs.existsSync(indexFile)) {
    fs.writeFileSync(indexFile, '// Entry point for ' + domain + ' module\n', 'utf8');
  }
  
  // Create placeholders
  FOLDERS.forEach(folder => {
    ensureDir(path.join(domainDir, folder));
  });
});

// 2. Map old absolute paths to new absolute paths
const fileMap = new Map(); // oldAbsPath -> newAbsPath
MOVES.forEach(m => {
  fileMap.set(path.join(ROOT_DIR, m.src), path.join(ROOT_DIR, m.dest));
});

// 3. Move files
MOVES.forEach(m => {
  const oldPath = path.join(ROOT_DIR, m.src);
  const newPath = path.join(ROOT_DIR, m.dest);
  if (fs.existsSync(oldPath)) {
    ensureDir(path.dirname(newPath));
    fs.renameSync(oldPath, newPath);
    console.log(`Moved: ${m.src} -> ${m.dest}`);
  }
});

// Helper to find all JS files
function getAllFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (EXCLUDED_DIRS.includes(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (file.endsWith('.js') || file.endsWith('.cjs')) {
      files.push(fullPath);
    }
  }
  return files;
}

// 4. Update imports in ALL files
const allFiles = getAllFiles(ROOT_DIR);
let updatedFilesCount = 0;

allFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Regex to match require('...') or require("...")
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  
  content = content.replace(requireRegex, (match, importPath) => {
    // Only care about relative imports
    if (!importPath.startsWith('.')) return match;
    
    const currentDir = path.dirname(filePath);
    let absImportPath = path.resolve(currentDir, importPath);
    
    if (!absImportPath.endsWith('.js')) {
      absImportPath += '.js';
    }

    let fileWasMoved = false;
    let oldFileDir = currentDir;
    for (const [oldAbs, newAbs] of fileMap.entries()) {
      if (newAbs === filePath) {
        fileWasMoved = true;
        oldFileDir = path.dirname(oldAbs);
        break;
      }
    }

    let actualTargetAbs;
    let newTargetAbs = fileMap.get(absImportPath);

    if (newTargetAbs) {
      actualTargetAbs = newTargetAbs;
    } else {
      if (fileWasMoved) {
         let originalTargetAbs = path.resolve(oldFileDir, importPath);
         if (!originalTargetAbs.endsWith('.js')) originalTargetAbs += '.js';
         
         if (fileMap.has(originalTargetAbs)) {
           actualTargetAbs = fileMap.get(originalTargetAbs);
         } else {
           actualTargetAbs = originalTargetAbs;
         }
      } else {
        return match;
      }
    }

    let newRelative = path.relative(currentDir, actualTargetAbs);
    
    if (newRelative.endsWith('.js')) {
      newRelative = newRelative.slice(0, -3);
    }
    
    newRelative = newRelative.replace(/\\/g, '/');
    
    if (!newRelative.startsWith('.')) {
      newRelative = './' + newRelative;
    }

    return `require('${newRelative}')`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedFilesCount++;
    console.log(`Updated imports in: ${path.relative(ROOT_DIR, filePath)}`);
  }
});

console.log(`\nBatch 3 Migration Complete. Updated ${updatedFilesCount} files.`);
