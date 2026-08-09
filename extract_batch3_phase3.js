const fs = require('fs');
const path = require('path');

function getRelativeFromServicesDir(originalDir, importPath) {
  if (!importPath.startsWith('.')) return importPath;
  const absFromRoutes = path.resolve(originalDir, importPath);
  const servicesDir = path.resolve(path.dirname(originalDir), 'services');
  return './' + path.relative(servicesDir, absFromRoutes).replace(/\\/g, '/');
}

function extractDomain({ domain, routeFile, serviceName, controllerName }) {
  if (!fs.existsSync(routeFile)) {
    console.log(`⚠️ Skipping ${domain} — route file not found: ${routeFile}`);
    return;
  }
  const routesDir = path.dirname(routeFile);
  const domainDir = path.dirname(routesDir);
  const servicesDir = path.join(domainDir, 'services');
  const controllersDir = path.join(domainDir, 'controllers');

  fs.mkdirSync(servicesDir, { recursive: true });
  fs.mkdirSync(controllersDir, { recursive: true });

  const code = fs.readFileSync(routeFile, 'utf8');
  const lines = code.split('\n');

  const ROUTE_ONLY_REQUIRES = ['express', 'authMiddleware', 'branchFilter', 'authorize', 'authorizeAny', 'authorizeAll',
    'legacyMapping', 'NEW_PERMISSIONS', 'PERMISSIONS', 'authRateLimit', 'sanitizeRegex', 'multer',
    'loginLimiter', 'captchaLimiter', 'sensitiveFlowLimiter', 'checkRoleLimiter',
    'assertStudentBranchAccess', 'passport', 'csrf', 'issueCsrfToken', 'userHasPermission'];

  const importLines = [];
  const requireRegex = /^const\s+\{?.*?\}?\s*=\s*require\(['"`](.*?)['"`]\);/;

  for (const line of lines) {
    const m = line.match(requireRegex);
    if (!m) continue;
    const importPath = m[1];
    const isRouteOnly = ROUTE_ONLY_REQUIRES.some(k => line.includes(k)) ||
      importPath.includes('middleware') || importPath.includes('multer') ||
      importPath.includes('passport') || importPath.includes('authRateLimit') ||
      importPath.includes('csrf');

    if (!isRouteOnly) {
      let rebased = line;
      if (importPath.startsWith('.')) {
        const newPath = getRelativeFromServicesDir(routesDir, importPath);
        rebased = line.replace(importPath, newPath);
      }
      importLines.push(rebased);
    }
  }

  const firstRouteIdx = code.search(/^router\.(get|post|put|patch|delete)/m);
  const preamble = firstRouteIdx > 0 ? code.slice(0, firstRouteIdx) : '';
  const helperLines = preamble.split('\n').filter(l => {
    const t = l.trim();
    return t && !/^const\s+.*require/.test(t) && !/^const router =/.test(t) && !/^const express =/.test(t) && !/^module\.exports/.test(t);
  });

  const routes = [];
  const routePattern = /^router\.(get|post|put|patch|delete)\(/m;
  let searchCode = code;
  let offset = 0;

  while (true) {
    const relIdx = searchCode.search(routePattern);
    if (relIdx === -1) break;
    const absIdx = offset + relIdx;

    let block = '';
    let depth = 0;
    let started = false;
    let i = absIdx;
    while (i < code.length) {
      const ch = code[i];
      if (ch === '(') { depth++; started = true; }
      if (ch === ')') depth--;
      block += ch;
      i++;
      if (started && depth <= 0) break;
    }
    while (i < code.length && (code[i] === ';' || code[i] === '\r' || code[i] === '\n')) {
      block += code[i++];
    }

    const headerMatch = block.match(/^router\.(get|post|put|patch|delete)\(['"`](.*?)['"`]/);
    if (!headerMatch) { searchCode = code.slice(i); offset = i; continue; }
    const method = headerMatch[1];
    const routePath = headerMatch[2];

    const handlerMatch = block.match(/async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{([\s\S]*)\}\s*\)[\s\S]*$/);
    const handlerBody = handlerMatch ? handlerMatch[1] : '';

    const safePath = routePath
      .replace(/^\//, '').replace(/\//g, '_').replace(/:/g, '').replace(/[-]/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '') || 'root';
    let methodName = method + '_' + safePath;
    
    let duplicateCount = 1;
    let originalName = methodName;
    while(routes.some(r => r.methodName === methodName)) {
        methodName = originalName + '_' + duplicateCount;
        duplicateCount++;
    }

    routes.push({ method, routePath, methodName, handlerBody, block, endIdx: i });
    searchCode = code.slice(i);
    offset = i;
  }

  const uniqueImports = [...new Set(importLines)].filter(l => l.trim());
  let serviceCode = `'use strict';\n`;
  serviceCode += uniqueImports.join('\n') + '\n\n';
  const cleanHelpers = helperLines.filter(l => l.trim());
  if (cleanHelpers.length) serviceCode += cleanHelpers.join('\n') + '\n\n';

  serviceCode += `class ${serviceName} {\n`;
  for (const { methodName, handlerBody } of routes) {
    let body = handlerBody
      .replace(/\breq\./g, 'data.')
      .replace(/return\s+res\.status\((\d+)\)\.json\(/g, 'return { _status: $1, _body: (')
      .replace(/res\.status\((\d+)\)\.json\(/g, 'return { _status: $1, _body: (')
      .replace(/return\s+res\.json\(/g, 'return { _status: 200, _body: (')
      .replace(/res\.json\(/g, 'return { _status: 200, _body: (')
      .replace(/return\s+res\.status\((\d+)\)\.send\(/g, 'return { _status: $1, _isSend: true, _body: (')
      .replace(/res\.status\((\d+)\)\.send\(/g, 'return { _status: $1, _isSend: true, _body: (')
      .replace(/res\.cookie\(/g, 'data._res.cookie(')
      .replace(/res\.clearCookie\(/g, 'data._res.clearCookie(')
      .replace(/res\.redirect\(/g, 'data._res.redirect(')
      .replace(/res\.download\(/g, 'data._res.download(')
      .replace(/res\.set\(/g, 'data._res.set(')
      .replace(/res\.end\(/g, 'data._res.end(');
    serviceCode += `  async ${methodName}(data) {${body}}\n\n`;
  }
  serviceCode += `}\n\nmodule.exports = new ${serviceName}();\n`;

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

  let newRouteCode = code;
  const controllerVar = controllerName.charAt(0).toLowerCase() + controllerName.slice(1);
  
  for (const { methodName, block } of routes) {
    const handlerIdx = block.indexOf('async (req, res)');
    if (handlerIdx === -1) continue;
    const beforeHandler = block.slice(0, handlerIdx).trimEnd();
    const newLine = beforeHandler + `${controllerVar}.${methodName});`;
    newRouteCode = newRouteCode.replace(block.trimEnd(), newLine.trimEnd());
  }

  newRouteCode = newRouteCode.replace(
    /const router = express\.Router\(\);/,
    `const router = express.Router();\nconst ${controllerVar} = require('../controllers/${controllerName}');`
  );

  for (const imp of importLines) {
    const orig = lines.find(l => l === imp);
    if (orig) newRouteCode = newRouteCode.replace(orig + '\n', '').replace(orig + '\r\n', '');
  }

  fs.writeFileSync(path.join(servicesDir, `${serviceName}.js`), serviceCode);
  fs.writeFileSync(path.join(controllersDir, `${controllerName}.js`), controllerCode);
  fs.writeFileSync(routeFile, newRouteCode);

  console.log(`✅ ${domain}: ${routes.length} routes → ${serviceName}`);
}

const BASE = __dirname;
extractDomain({
  domain: 'evaluation',
  routeFile: path.join(BASE, 'modules/exam/routes/evaluationRoutes.js'),
  serviceName: 'EvaluationApplicationService',
  controllerName: 'EvaluationController',
});
extractDomain({
  domain: 'examResult',
  routeFile: path.join(BASE, 'modules/exam/routes/examResultRoutes.js'),
  serviceName: 'ExamResultApplicationService',
  controllerName: 'ExamResultController',
});
extractDomain({
  domain: 'proctor',
  routeFile: path.join(BASE, 'modules/exam/routes/proctorRoutes.js'),
  serviceName: 'ProctorApplicationService',
  controllerName: 'ProctorController',
});
extractDomain({
  domain: 'quiz',
  routeFile: path.join(BASE, 'modules/exam/routes/quizRoutes.js'),
  serviceName: 'QuizApplicationService',
  controllerName: 'QuizController',
});
