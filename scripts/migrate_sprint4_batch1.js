const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const EXCLUDED_DIRS = ['node_modules', 'client', '.git', 'dist'];

const MOVES = [
  { src: 'routes/authRoutes.js', dest: 'modules/auth/authRoutes.js' },
  { src: 'models/Employee.js', dest: 'modules/auth/models/Employee.js' },
  
  { src: 'routes/branchRoutes.js', dest: 'modules/branch/branchRoutes.js' },
  { src: 'controllers/branchController.js', dest: 'modules/branch/branchController.js' },
  { src: 'models/Branch.js', dest: 'modules/branch/models/Branch.js' },
  
  { src: 'routes/tenantRoutes.js', dest: 'modules/tenant/tenantRoutes.js' },
  { src: 'services/tenantService.js', dest: 'modules/tenant/tenantService.js' },
  { src: 'models/Tenant.js', dest: 'modules/tenant/models/Tenant.js' },
  
  { src: 'routes/settingsRoutes.js', dest: 'modules/system/settingsRoutes.js' },
  { src: 'controllers/settingsController.js', dest: 'modules/system/settingsController.js' },
  { src: 'services/settingsCache.js', dest: 'modules/system/settingsCache.js' },
  { src: 'models/SystemSettings.js', dest: 'modules/system/models/SystemSettings.js' }
];

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. Map old absolute paths to new absolute paths
const fileMap = new Map(); // oldAbsPath -> newAbsPath
MOVES.forEach(m => {
  fileMap.set(path.join(ROOT_DIR, m.src), path.join(ROOT_DIR, m.dest));
});

// 2. Move files
MOVES.forEach(m => {
  const oldPath = path.join(ROOT_DIR, m.src);
  const newPath = path.join(ROOT_DIR, m.dest);
  if (fs.existsSync(oldPath)) {
    ensureDir(newPath);
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

// 3. Update imports in ALL files
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
    
    // Determine absolute path of what was being imported
    const currentDir = path.dirname(filePath);
    let absImportPath = path.resolve(currentDir, importPath);
    
    // Check if it resolves to a .js file or a directory with index.js (simplified)
    if (!absImportPath.endsWith('.js')) {
      absImportPath += '.js';
    }

    // Did this target file move?
    let newTargetAbs = fileMap.get(absImportPath);
    
    // Wait, what if the FILE ITSELF moved, and it is importing something that DID NOT move?
    // We need the old directory of this file if it moved.
    // Let's find if filePath is a new file location
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
    if (newTargetAbs) {
      // The target moved.
      actualTargetAbs = newTargetAbs;
    } else {
      // The target didn't move.
      // But if the CURRENT file moved, we need to recalculate the relative path to the target.
      // Wait, we computed absImportPath using currentDir. If current file moved, currentDir is the NEW dir.
      // But the import string in the file was written relative to the OLD dir.
      // So we must compute absImportPath relative to the OLD dir.
      if (fileWasMoved) {
         let originalTargetAbs = path.resolve(oldFileDir, importPath);
         if (!originalTargetAbs.endsWith('.js')) originalTargetAbs += '.js';
         // Did the target move?
         if (fileMap.has(originalTargetAbs)) {
           actualTargetAbs = fileMap.get(originalTargetAbs);
         } else {
           actualTargetAbs = originalTargetAbs;
         }
      } else {
        // Neither moved, skip
        return match;
      }
    }

    // Now compute the new relative path from currentDir to actualTargetAbs
    let newRelative = path.relative(currentDir, actualTargetAbs);
    
    // Remove .js extension for consistency
    if (newRelative.endsWith('.js')) {
      newRelative = newRelative.slice(0, -3);
    }
    
    // Normalize path separators to forward slashes
    newRelative = newRelative.replace(/\\/g, '/');
    
    // Ensure it starts with ./ if it's in the same dir
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

console.log(`\nBatch 1 Migration Complete. Updated ${updatedFilesCount} files.`);
