const fs = require('fs');

let code = `
router.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, token: 'abc' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
`;

function extractServiceController(code, domainName) {
  // We want to extract callbacks and replace res.json and res.status
  const routeRegex = /router\.(get|post|put|delete|patch)\(['"`](.*?)['"`](?:.*?),\s*(async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{([\s\S]*?)\})\s*\);/g;
  
  let match;
  let serviceCode = `class ${domainName}ApplicationService {\n`;
  let controllerCode = `class ${domainName}Controller {\n`;
  let newRouteCode = code;

  let index = 1;
  while ((match = routeRegex.exec(code)) !== null) {
    const method = match[1];
    const path = match[2];
    const callbackStr = match[3];
    const innerCode = match[4];

    // Create a generic method name
    const methodName = \`handle\${method.toUpperCase()}\${index}\`;
    index++;

    // Replace res.status().json() with return
    let svcInner = innerCode
      .replace(/return\s+res\.status\((\d+)\)\.json\((.*?)\);/g, 'return { _status: $1, _body: $2 };')
      .replace(/res\.status\((\d+)\)\.json\((.*?)\);/g, 'return { _status: $1, _body: $2 };')
      .replace(/return\s+res\.json\((.*?)\);/g, 'return { _status: 200, _body: $1 };')
      .replace(/res\.json\((.*?)\);/g, 'return { _status: 200, _body: $1 };');

    // Also replace req.body / req.query / req.params if we want, but ARB says "No Service may parse HTTP requests (req, res, next)"
    // So the service signature should be `async methodName(reqData)`
    // But since it's hard to find all usages, we can pass `data = { body: req.body, query: req.query, params: req.params, headers: req.headers, user: req.currentUser }`
    // And replace `req.` with `data.`
    svcInner = svcInner.replace(/\breq\./g, 'data.');

    serviceCode += \`  async \${methodName}(data) {\${svcInner}}\n\`;

    // Controller method
    controllerCode += \`  async \${methodName}(req, res) {
    try {
      const data = { body: req.body, query: req.query, params: req.params, headers: req.headers, currentUser: req.currentUser, user: req.user, file: req.file };
      const result = await \${domainName.toLowerCase()}Service.\${methodName}(data);
      if (result && result._status) {
        return res.status(result._status).json(result._body);
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }\n\`;

    // Route code
    newRouteCode = newRouteCode.replace(callbackStr, \`\${domainName.toLowerCase()}Controller.\${methodName}\`);
  }

  serviceCode += `}\n`;
  controllerCode += `}\n`;

  console.log('SERVICE:');
  console.log(serviceCode);
  console.log('CONTROLLER:');
  console.log(controllerCode);
  console.log('ROUTE:');
  console.log(newRouteCode);
}

extractServiceController(code, 'Auth');
