export function getPresenceUserId(user) {
  return String(user?.userId || user?.id || user?._id || '');
}

export function getEntityUserId(entity) {
  return String(entity?.studentId || entity?.userId || entity?.id || entity?._id || '');
}

export function isUserOnline(onlineUsers, entity) {
  const entityId = getEntityUserId(entity);
  if (!entityId || !Array.isArray(onlineUsers)) return false;
  return onlineUsers.some((user) => {
    if (getPresenceUserId(user) !== entityId) return false;
    const presenceRole = String(user?.role || '').toLowerCase();
    if (!presenceRole) return false;
    const entityRole = String(entity?.role || '').toLowerCase();
    if (entityRole === 'teacher' || entityRole === 'admin' || entityRole === 'staff') {
      return presenceRole === entityRole;
    }
    return presenceRole === 'student';
  });
}
