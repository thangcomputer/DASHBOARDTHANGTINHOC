const fs = require('fs');
const path = require('path');

/**
 * Batch 2 Service Extractor
 * For each domain: creates services/ and controllers/ dirs,
 * writes ApplicationService (business logic) and Controller (orchestration),
 * then rewrites the route file to delegate to the controller.
 *
 * Strategy:
 *  1. Read original route file
 *  2. Extract all imports (non-express, non-router) → go to Service
 *  3. Extract helper functions → go to Service
 *  4. For each route handler: extract body → Service method, replace with Controller delegation
 *  5. Write Service, Controller, updated Routes
 */

function getRelativeFromServicesDir(originalDir, importPath) {
  // originalDir = modules/student/routes
  // newServicesDir = modules/student/services
  // We need to rebase relative paths from routes → services
  if (!importPath.startsWith('.')) return importPath; // absolute/node_modules
  const absFromRoutes = path.resolve(originalDir, importPath);
  const servicesDir = path.resolve(path.dirname(originalDir), 'services');
  return './' + path.relative(servicesDir, absFromRoutes).replace(/\\/g, '/');
}

function extractDomain({ domain, routeFile, serviceName, controllerName }) {
  const routesDir = path.dirname(routeFile);
  const domainDir = path.dirname(routesDir);
  const servicesDir = path.join(domainDir, 'services');
  const controllersDir = path.join(domainDir, 'controllers');

  fs.mkdirSync(servicesDir, { recursive: true });
  fs.mkdirSync(controllersDir, { recursive: true });

  const code = fs.readFileSync(routeFile, 'utf8');
  const lines = code.split('\n');

  // ── 1. Collect imports ──────────────────────────────────────────────────
  const importLines = [];
  const routeImportLines = []; // Only express + auth middleware stay in routes
  const ROUTE_ONLY_REQUIRES = ['express', 'authMiddleware', 'branchFilter', 'authorize', 'authorizeAny', 'authorizeAll',
    'legacyMapping', 'NEW_PERMISSIONS', 'PERMISSIONS', 'authRateLimit', 'sanitizeRegex', 'multer', 'upload', 'path', 'fs', 'storage',
    'loginLimiter', 'captchaLimiter', 'refreshTokenLimiter', 'sensitiveFlowLimiter', 'checkRoleLimiter',
    'assertStudentBranchAccess', 'passport', 'GoogleStrategy', 'csrf', 'issueCsrfToken'];

  const requireRegex = /^const\s+\{?.*?\}?\s*=\s*require\(['"`](.*?)['"`]\);/;

  for (const line of lines) {
    const m = line.match(requireRegex);
    if (!m) continue;
    const importPath = m[1];
    const isRouteOnly = ROUTE_ONLY_REQUIRES.some(k => line.includes(k)) ||
      importPath.includes('middleware') || importPath.includes('multer') ||
      importPath.includes('passport') || importPath.includes('authRateLimit') ||
      importPath.includes('csrf') || importPath.includes('svgCaptcha') ||
      importPath.includes('qrcode') || importPath.includes('QRCode');

    if (isRouteOnly) {
      routeImportLines.push(line);
    } else {
      // Rebase path from routes dir → services dir
      let rebased = line;
      if (importPath.startsWith('.')) {
        const newPath = getRelativeFromServicesDir(routesDir, importPath);
        rebased = line.replace(importPath, newPath);
      }
      importLines.push(rebased);
    }
  }

  // ── 2. Extract helper functions (non-router code before first router.xxx) ──
  const firstRouteIdx = lines.findIndex(l => /^router\.(get|post|put|patch|delete)/.test(l.trim()));
  const helperLines = [];
  let inBlock = false;
  let braceDepth = 0;
  for (let i = 0; i < (firstRouteIdx === -1 ? lines.length : firstRouteIdx); i++) {
    const line = lines[i];
    const isImport = /^const\s+.*require/.test(line.trim());
    const isRouterInit = /^const\s+router\s*=/.test(line.trim()) || /^const\s+express\s*=/.test(line.trim());
    const isPassport = /^passport\./.test(line.trim());
    const isInterval = /setInterval/.test(line);
    const isCaptchaStore = /captchaStore/.test(line) && !line.includes('require');
    if (!isImport && !isRouterInit && !isPassport && !isInterval) {
      helperLines.push(line);
    } else if (isPassport || isInterval || isCaptchaStore) {
      helperLines.push(line);
    }
  }

  // ── 3. Extract route handlers ──────────────────────────────────────────
  const routes = [];
  const routePattern = /^router\.(get|post|put|patch|delete)\(/;
  let i = 0;
  const codeLines = code.split('\n');
  
  while (i < codeLines.length) {
    const line = codeLines[i];
    if (!routePattern.test(line.trim())) { i++; continue; }
    
    // Collect the full route block until the matching closing ");"
    let block = '';
    let depth = 0;
    let started = false;
    let j = i;
    while (j < codeLines.length) {
      const l = codeLines[j];
      for (const ch of l) {
        if (ch === '(') { depth++; started = true; }
        if (ch === ')') depth--;
      }
      block += l + '\n';
      if (started && depth <= 0) { j++; break; }
      j++;
    }
    
    // Parse method and path
    const headerMatch = line.trim().match(/^router\.(get|post|put|patch|delete)\(['"`](.*?)['"`]/);
    if (!headerMatch) { i = j; continue; }
    const method = headerMatch[1];
    const routePath = headerMatch[2];
    
    // Extract the async handler body
    const handlerMatch = block.match(/async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{([\s\S]*)\}\s*\);\s*$/);
    const handlerBody = handlerMatch ? handlerMatch[1] : '';
    
    // Generate a safe method name from path
    const safePath = routePath
      .replace(/^\//, '').replace(/\//g, '_').replace(/:/g, '').replace(/[-]/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '') || 'root';
    const methodName = method + '_' + safePath;
    
    routes.push({ method, routePath, methodName, handlerBody, block });
    i = j;
  }

  // ── 4. Build Service ──────────────────────────────────────────────────
  // Deduplicate imports
  const uniqueImports = [...new Set(importLines)].filter(l => l.trim());
  
  let serviceCode = `'use strict';\n`;
  serviceCode += uniqueImports.join('\n') + '\n\n';
  
  // Helper lines (non-import, non-router)
  const cleanHelpers = helperLines.filter(l => {
    const t = l.trim();
    return t && !t.startsWith('const express') && !t.startsWith('const router') && !/^const\s+.*=\s*require/.test(t);
  });
  if (cleanHelpers.length) serviceCode += cleanHelpers.join('\n') + '\n\n';

  serviceCode += `class ${serviceName} {\n`;
  for (const { methodName, handlerBody } of routes) {
    // Replace req.xxx → data.xxx, res.xxx → throw / return value
    let body = handlerBody
      .replace(/\breq\./g, 'data.')
      .replace(/return\s+res\.status\((\d+)\)\.json\(([\s\S]*?)\);/g, 'return { _status: $1, _body: $2 };')
      .replace(/res\.status\((\d+)\)\.json\(([\s\S]*?)\);/g, 'return { _status: $1, _body: $2 };')
      .replace(/return\s+res\.json\(([\s\S]*?)\);/g, 'return { _status: 200, _body: $1 };')
      .replace(/res\.json\(([\s\S]*?)\);/g, 'return { _status: 200, _body: $1 };')
      .replace(/return\s+res\.status\((\d+)\)\.send\(([\s\S]*?)\);/g, 'return { _status: $1, _body: $2, _isSend: true };')
      .replace(/res\.status\((\d+)\)\.send\(([\s\S]*?)\);/g, 'return { _status: $1, _body: $2, _isSend: true };')
      .replace(/res\.cookie\(/g, 'data._res.cookie(')
      .replace(/res\.clearCookie\(/g, 'data._res.clearCookie(')
      .replace(/res\.redirect\(/g, 'data._res.redirect(')
      .replace(/res\.download\(/g, 'data._res.download(')
      .replace(/res\.sendFile\(/g, 'data._res.sendFile(')
      .replace(/res\.set\(/g, 'data._res.set(')
      .replace(/res\.end\(/g, 'data._res.end(');
    
    serviceCode += `  async ${methodName}(data) {${body}}\n\n`;
  }
  serviceCode += `}\n\nmodule.exports = new ${serviceName}();\n`;

  // ── 5. Build Controller ───────────────────────────────────────────────
  const serviceVar = serviceName.charAt(0).toLowerCase() + serviceName.slice(1);
  let controllerCode = `'use strict';\nconst ${serviceVar} = require('../services/${serviceName}');\n\n`;
  controllerCode += `class ${controllerName} {\n`;
  for (const { methodName } of routes) {
    controllerCode += `  async ${methodName}(req, res) {
    try {
      const data = {
        body: req.body, query: req.query, params: req.params, headers: req.headers,
        currentUser: req.currentUser, user: req.user, file: req.file, files: req.files,
        ip: req.ip, app: req.app, _res: res,
      };
      const result = await ${serviceVar}.${methodName}(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
    }
  }\n\n`;
  }
  controllerCode += `}\n\nmodule.exports = new ${controllerName}();\n`;

  // ── 6. Rewrite Routes file ────────────────────────────────────────────
  const controllerVar = controllerName.charAt(0).toLowerCase() + controllerName.slice(1);
  let newRouteCode = code;
  
  // Replace each handler block with controller delegation
  for (const { methodName, block, method, routePath } of routes) {
    // The route line with the async handler – replace the handler with controller method reference
    // Find the "async (req, res) => { ... }" and replace it
    const handlerStart = block.indexOf('async (req, res)');
    if (handlerStart === -1) continue;
    const beforeHandler = block.slice(0, handlerStart);
    // Build clean replacement line
    const newLine = beforeHandler.trimEnd() + `${controllerVar}.${methodName});`;
    newRouteCode = newRouteCode.replace(block.trimEnd(), newLine.trimEnd());
  }
  
  // Add controller require after router declaration
  newRouteCode = newRouteCode.replace(
    /const router = express\.Router\(\);/,
    `const router = express.Router();\nconst ${controllerVar} = require('../controllers/${controllerName}');`
  );
  // Remove non-route imports that moved to service
  for (const imp of importLines) {
    const original = lines.find(l => l === imp);
    if (original) newRouteCode = newRouteCode.replace(original + '\n', '');
  }

  // ── 7. Write files ─────────────────────────────────────────────────────
  fs.writeFileSync(path.join(servicesDir, `${serviceName}.js`), serviceCode);
  fs.writeFileSync(path.join(controllersDir, `${controllerName}.js`), controllerCode);
  fs.writeFileSync(routeFile, newRouteCode);

  console.log(`✅ ${domain}: ${routes.length} routes extracted → ${serviceName}, ${controllerName}`);
}

// Run for each Batch 2 domain
const BASE = __dirname;

try {
  extractDomain({
    domain: 'attendance',
    routeFile: path.join(BASE, 'modules/attendance/routes/scheduleRoutes.js'),
    serviceName: 'AttendanceApplicationService',
    controllerName: 'AttendanceController',
  });
} catch (e) { console.error('attendance ERROR:', e.message); }

try {
  extractDomain({
    domain: 'course/courseRoutes',
    routeFile: path.join(BASE, 'modules/course/routes/courseRoutes.js'),
    serviceName: 'CourseApplicationService',
    controllerName: 'CourseController',
  });
} catch (e) { console.error('course ERROR:', e.message); }

try {
  extractDomain({
    domain: 'course/assignmentRoutes',
    routeFile: path.join(BASE, 'modules/course/routes/assignmentRoutes.js'),
    serviceName: 'AssignmentApplicationService',
    controllerName: 'AssignmentController',
  });
} catch (e) { console.error('assignment ERROR:', e.message); }

try {
  extractDomain({
    domain: 'course/trainingRoutes',
    routeFile: path.join(BASE, 'modules/course/routes/trainingRoutes.js'),
    serviceName: 'TrainingApplicationService',
    controllerName: 'TrainingController',
  });
} catch (e) { console.error('training ERROR:', e.message); }

try {
  extractDomain({
    domain: 'course/teachingGuideRoutes',
    routeFile: path.join(BASE, 'modules/course/routes/teachingGuideRoutes.js'),
    serviceName: 'TeachingGuideApplicationService',
    controllerName: 'TeachingGuideController',
  });
} catch (e) { console.error('teachingGuide ERROR:', e.message); }
