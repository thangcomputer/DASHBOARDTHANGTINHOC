export function getPresenceUserId(user) {
  return String(user?.userId || user?.id || user?._id || '');
}

export function getEntityUserId(entity) {
  return String(entity?.studentId || entity?.userId || entity?.id || entity?._id || '');
}

export function isUserOnline(onlineUsers, entity) {
  const entityId = getEntityUserId(entity);
  if (!entityId || !Array.isArray(onlineUsers)) return false;
  return onlineUsers.some((user) => getPresenceUserId(user) === entityId);
}
