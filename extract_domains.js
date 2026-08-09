const fs = require('fs');
const path = require('path');

function processDomain(domainName, routesFilePath, controllerName, serviceName) {
  const routesDir = path.dirname(routesFilePath);
  const domainDir = path.dirname(routesDir);
  const controllersDir = path.join(domainDir, 'controllers');
  const servicesDir = path.join(domainDir, 'services');

  if (!fs.existsSync(controllersDir)) fs.mkdirSync(controllersDir, { recursive: true });
  if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir, { recursive: true });

  let code = fs.readFileSync(routesFilePath, 'utf8');

  const routeRegex = /router\.(get|post|put|delete|patch)\(['"`](.*?)['"`](?:.*?),\s*(async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{([\s\S]*?)\})\s*\);/g;
  
  let match;
  let serviceCode = `class ${serviceName} {\n`;
  let controllerCode = `const ${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)} = require('../services/${serviceName}');\n\nclass ${controllerName} {\n`;
  let newRouteCode = code;

  let index = 1;
  const methods = [];

  while ((match = routeRegex.exec(code)) !== null) {
    const method = match[1];
    const pathRoute = match[2];
    const callbackStr = match[3];
    let innerCode = match[4];

    let methodName = method + pathRoute.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/_$/, '');
    if (methodName.endsWith('_')) methodName = methodName.slice(0, -1);
    if (!methodName || methodName === method) methodName = method + 'Root';
    methodName = methodName + index; // ensure uniqueness
    index++;
    methods.push(methodName);

    // Replace res returns
    let svcInner = innerCode
      .replace(/return\s+res\.status\((\d+)\)\.json\((.*?)\);/g, 'return { _status: $1, _body: $2 };')
      .replace(/res\.status\((\d+)\)\.json\((.*?)\);/g, 'return { _status: $1, _body: $2 };')
      .replace(/return\s+res\.json\((.*?)\);/g, 'return { _status: 200, _body: $1 };')
      .replace(/res\.json\((.*?)\);/g, 'return { _status: 200, _body: $1 };')
      .replace(/return\s+res\.status\((\d+)\)\.send\((.*?)\);/g, 'return { _status: $1, _body: $2, _isSend: true };')
      .replace(/res\.status\((\d+)\)\.send\((.*?)\);/g, 'return { _status: $1, _body: $2, _isSend: true };')
      .replace(/return\s+res\.send\((.*?)\);/g, 'return { _status: 200, _body: $1, _isSend: true };')
      .replace(/res\.send\((.*?)\);/g, 'return { _status: 200, _body: $1, _isSend: true };')
      .replace(/res\.cookie\(/g, 'data._res.cookie(')
      .replace(/res\.clearCookie\(/g, 'data._res.clearCookie(');

    // Replace req
    svcInner = svcInner.replace(/\breq\./g, 'data.');

    serviceCode += `  async ${methodName}(data) {${svcInner}}\n`;

    controllerCode += `  async ${methodName}(req, res) {
    try {
      const data = { 
        body: req.body, query: req.query, params: req.params, headers: req.headers, 
        currentUser: req.currentUser, user: req.user, file: req.file, ip: req.ip,
        app: req.app, _res: res 
      };
      const result = await ${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}.${methodName}(data);
      if (result && result._status) {
        if (result._isSend) return res.status(result._status).send(result._body);
        return res.status(result._status).json(result._body);
      }
      if (result === undefined) return;
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }\n`;

    newRouteCode = newRouteCode.replace(callbackStr, `${controllerName.charAt(0).toLowerCase() + controllerName.slice(1)}.${methodName}`);
  }

  serviceCode += `}\n\nmodule.exports = new ${serviceName}();\n`;
  controllerCode += `}\n\nmodule.exports = new ${controllerName}();\n`;
  
  // Add controller require to route
  newRouteCode = newRouteCode.replace(
    'const router = express.Router();', 
    `const router = express.Router();\nconst ${controllerName.charAt(0).toLowerCase() + controllerName.slice(1)} = require('../controllers/${controllerName}');`
  );

  // We need to copy imports from Routes to Service
  const importsRegex = /const\s+.*?\s*=\s*require\(.*?\);\n/g;
  let imports = '';
  let impMatch;
  while ((impMatch = importsRegex.exec(code)) !== null) {
    if (!impMatch[0].includes('express')) {
      imports += impMatch[0];
    }
  }

  // Adjust relative paths in imports for Service
  // Usually from routes to services is just same level, so ../ to ../../ if needed, but wait:
  // routes is in modules/auth/routes, services is in modules/auth/services
  // so relative paths like '../../' remain '../../', and '../' remains '../'.
  serviceCode = imports + '\n' + serviceCode;

  fs.writeFileSync(path.join(servicesDir, `${serviceName}.js`), serviceCode);
  fs.writeFileSync(path.join(controllersDir, `${controllerName}.js`), controllerCode);
  fs.writeFileSync(routesFilePath, newRouteCode);
  console.log(`Successfully migrated ${domainName}`);
}

try {
  processDomain('System', path.join(__dirname, 'modules/system/settingsRoutes.js'), 'SystemController', 'SystemApplicationService');
  processDomain('Auth', path.join(__dirname, 'modules/auth/authRoutes.js'), 'AuthController', 'AuthApplicationService');
} catch(e) {
  console.error(e);
}
