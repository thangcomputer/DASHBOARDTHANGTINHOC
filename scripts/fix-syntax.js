const fs = require('fs');

const files = [
  './client/src/components/Inbox.jsx',
  './client/src/components/FloatingMessenger.jsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf-8');
  c = c.replace(/conv\.\['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF'\]\.includes\(user\.roleCode\)/g, "['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF'].includes(conv.user?.roleCode)");
  c = c.replace(/tab\.\['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF'\]\.includes\(user\.roleCode\)/g, "['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF'].includes(tab.user?.roleCode)");
  fs.writeFileSync(f, c);
});
