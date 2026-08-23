const fs = require('fs');
const path = 'd:/web/WEB T?NG H?P/DASHBOARDTHANGTINHOC/client/src/components/DashboardLayout.jsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  /const adminHash = \(location\.hash \|\| ''\)\.replace\('#', ''\) \|\| \(location\.pathname === '\/admin' \? 'dashboard' : ''\);\s*const activeHash = \(location\.hash \|\| ''\)\.replace\('#', ''\);/,
  "const activeHash = (location.hash || '').replace('#', '').split('?')[0];\n    const adminHash = activeHash || (location.pathname === '/admin' ? 'dashboard' : '');"
);
fs.writeFileSync(path, content);
