const fs = require('fs');
const path = require('path');

function getFiles(dir, ext, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory() && file !== 'node_modules') {
      getFiles(path.join(dir, file), ext, fileList);
    } else if (file.endsWith(ext)) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const servicesDir = path.join(__dirname, 'modules');
const serviceFiles = getFiles(servicesDir, 'ApplicationService.js');

const inventory = {};

for (const file of serviceFiles) {
  const code = fs.readFileSync(file, 'utf8');
  const serviceName = path.basename(file, '.js');
  
  if (!inventory[serviceName]) inventory[serviceName] = {};

  const methods = [...code.matchAll(/async\s+(\w+)\s*\(\s*data\s*\)\s*\{/g)];
  
  for (let i = 0; i < methods.length; i++) {
    const methodMatch = methods[i];
    const methodName = methodMatch[1];
    
    let endIdx = code.length;
    if (i < methods.length - 1) {
      endIdx = methods[i + 1].index;
    }
    
    const bodyCode = code.slice(methodMatch.index, endIdx);
    
    const extractFields = (regex) => {
      const matches = [...bodyCode.matchAll(regex)];
      return [...new Set(matches.map(m => m[1]))].sort();
    };
    
    const bodyFields = extractFields(/data\.body\.(\w+)/g);
    const queryFields = extractFields(/data\.query\.(\w+)/g);
    const paramsFields = extractFields(/data\.params\.(\w+)/g);
    
    const hasFile = bodyCode.includes('data.file');
    const hasFiles = bodyCode.includes('data.files');
    
    if (bodyFields.length || queryFields.length || paramsFields.length || hasFile || hasFiles) {
      inventory[serviceName][methodName] = {
        body: bodyFields,
        query: queryFields,
        params: paramsFields,
        file: hasFile,
        files: hasFiles
      };
    }
  }
}

fs.writeFileSync('dto_inventory_raw.json', JSON.stringify(inventory, null, 2));
console.log('DTO inventory raw data generated.');
