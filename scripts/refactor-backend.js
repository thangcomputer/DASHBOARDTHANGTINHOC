const fs = require('fs');
const path = require('path');

const backendFolders = ['../routes', '../services', '../middleware'];

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let modifiedCount = 0;

backendFolders.forEach(folder => {
  const targetDir = path.join(__dirname, folder);
  walkDir(targetDir, (filePath) => {
    if (!filePath.endsWith('.js')) return;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;

    // Just replace the import path
    content = content.replace(/require\(['"]\.\.\/middleware\/auth['"]\)/g, "require('../shared/middleware/authMiddleware')");

    // Replace req.user -> req.currentUser (if needed)
    content = content.replace(/req\.user(?!\w)/g, "req.currentUser");

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      modifiedCount++;
      console.log('Modified:', filePath);
    }
  });
});

console.log(`Backend Refactor Script complete. Modified ${modifiedCount} files.`);
