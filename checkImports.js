const fs = require('fs');
const p = 'd:/web/WEB TỔNG HỢP/DASHBOARDTHANGTINHOC/client/src/components/admin/tabs/AdminOverviewTab.jsx';
let content = fs.readFileSync(p, 'utf8');

// The file currently imports `hasPermission` from AuthContext?
// Let's check imports
