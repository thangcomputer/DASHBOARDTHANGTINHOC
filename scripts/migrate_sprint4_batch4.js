const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const EXCLUDED_DIRS = ['node_modules', 'client', '.git', 'dist'];

const DOMAINS = ['notification', 'chat', 'cms', 'blog', 'media', 'banner', 'feed', 'announcement', 'ai', 'upload', 'file'];
const FOLDERS = [
  'controllers', 'services', 'repositories', 'routes', 'models',
  'validators', 'dto', 'events', 'tests'
];

const MOVES = [
  // Notification
  { src: 'routes/notificationRoutes.js', dest: 'modules/notification/routes/notificationRoutes.js' },
  { src: 'models/Notification.js', dest: 'modules/notification/models/Notification.js' },
  { src: 'services/NotificationService.js', dest: 'modules/notification/services/NotificationService.js' },
  { src: 'services/notificationCenter.js', dest: 'modules/notification/services/notificationCenter.js' },

  // Chat
  { src: 'routes/messageRoutes.js', dest: 'modules/chat/routes/messageRoutes.js' },
  { src: 'models/Message.js', dest: 'modules/chat/models/Message.js' },
  { src: 'models/ConversationVisibility.js', dest: 'modules/chat/models/ConversationVisibility.js' },
  { src: 'services/chatAccessService.js', dest: 'modules/chat/services/chatAccessService.js' },
  { src: 'services/messaging', dest: 'modules/chat/services/messaging' },

  // CMS
  { src: 'routes/builderRoutes.js', dest: 'modules/cms/routes/builderRoutes.js' },
  { src: 'routes/workflowRoutes.js', dest: 'modules/cms/routes/workflowRoutes.js' },
  { src: 'models/FormDefinition.js', dest: 'modules/cms/models/FormDefinition.js' },
  { src: 'models/FormSubmission.js', dest: 'modules/cms/models/FormSubmission.js' },
  { src: 'models/WorkflowInstance.js', dest: 'modules/cms/models/WorkflowInstance.js' },
  { src: 'services/formService.js', dest: 'modules/cms/services/formService.js' },
  { src: 'services/workflowService.js', dest: 'modules/cms/services/workflowService.js' },

  // Blog
  { src: 'routes/blogRoutes.js', dest: 'modules/blog/routes/blogRoutes.js' },
  { src: 'models/BlogPost.js', dest: 'modules/blog/models/BlogPost.js' },

  // Feed
  { src: 'routes/feedRoutes.js', dest: 'modules/feed/routes/feedRoutes.js' },
  { src: 'models/FeedPost.js', dest: 'modules/feed/models/FeedPost.js' },

  // AI
  { src: 'routes/aiRoutes.js', dest: 'modules/ai/routes/aiRoutes.js' },
  { src: 'services/aiService.js', dest: 'modules/ai/services/aiService.js' },
  { src: 'services/ai', dest: 'modules/ai/services/ai' },

  // File
  { src: 'routes/fileRoutes.js', dest: 'modules/file/routes/fileRoutes.js' },
  { src: 'models/FileAsset.js', dest: 'modules/file/models/FileAsset.js' },
  { src: 'services/fileService.js', dest: 'modules/file/services/fileService.js' }
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

// Helper to copy/move directories recursively since fs.renameSync can't do it across devices, and renaming directories might need special handling.
// Actually, fs.renameSync works for directories if on the same device.
const fileMap = new Map(); // oldAbsPath -> newAbsPath

// To map all files inside directories being moved:
function buildFileMapForDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  const stat = fs.statSync(srcDir);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(srcDir);
    for (const f of files) {
      buildFileMapForDir(path.join(srcDir, f), path.join(destDir, f));
    }
  } else {
    fileMap.set(srcDir, destDir);
  }
}

// 2. Map old absolute paths to new absolute paths
MOVES.forEach(m => {
  const oldPath = path.join(ROOT_DIR, m.src);
  const newPath = path.join(ROOT_DIR, m.dest);
  if (fs.existsSync(oldPath)) {
    const stat = fs.statSync(oldPath);
    if (stat.isDirectory()) {
      buildFileMapForDir(oldPath, newPath);
    } else {
      fileMap.set(oldPath, newPath);
    }
  }
});

// 3. Move files & directories
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
  if (!fs.existsSync(dir)) return files;
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
    
    let isDirRequire = false;
    let absImportPath = path.resolve(currentDir, importPath);
    
    if (fs.existsSync(absImportPath) && fs.statSync(absImportPath).isDirectory()) {
        isDirRequire = true;
    } else if (!absImportPath.endsWith('.js') && !absImportPath.endsWith('.json')) {
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
    } else if (isDirRequire) {
        let movedDir = null;
        for (const [oldAbs, newAbs] of fileMap.entries()) {
            if (oldAbs.startsWith(absImportPath + path.sep)) {
                movedDir = path.dirname(newAbs);
                break;
            }
        }
        if (movedDir) {
           // We're requiring a directory that moved. This logic is a bit complex.
           actualTargetAbs = movedDir;
        } else {
             if (fileWasMoved) {
                 actualTargetAbs = path.resolve(oldFileDir, importPath);
             } else {
                 return match;
             }
        }
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

console.log(`\nBatch 4 Migration Complete. Updated ${updatedFilesCount} files.`);
