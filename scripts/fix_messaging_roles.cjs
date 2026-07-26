const fs = require('fs');
const path = require('path');

const content = `/** Dong bo voi utils/messagingRoles.js (server) */
export function getMessagingRole(user) {
  user = user || {};
  const id = String(user.id || user._id || '');
  if (id === 'admin') return 'admin';
  if (user.adminRole === 'STAFF' || user.role === 'staff') return 'staff';
  if (user.role === 'teacher' || user.role === 'student' || user.role === 'admin') return user.role;
  return user.role || 'admin';
}

export function isMessageFromSelf(data, user) {
  if (!data || !user) return false;
  const myId = String(user.id || user._id || '');
  const senderId = String(data.senderId || '');
  if (!myId || !senderId) return false;
  if (senderId !== myId) return false;
  const myRole = getMessagingRole(user);
  const senderRole = String(data.senderRole || '').toLowerCase();
  if (!senderRole) return true;
  if (senderRole === myRole) return true;
  if ((senderRole === 'admin' || senderRole === 'staff') && (myRole === 'admin' || myRole === 'staff')) {
    return true;
  }
  return false;
}
`;

const target = path.join(__dirname, '..', 'client', 'src', 'lib', 'messagingRoles.js');
fs.writeFileSync(target, content.replace('Dong bo', 'Đồng bộ'), 'utf8');
console.log('Wrote', target);
