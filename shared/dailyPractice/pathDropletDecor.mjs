/** Giọt nối mốc lộ trình phẳng (web + mobile). */
export const PATH_DROPLET = {
  path: 'M0-5 C-3-1 -5 1 -5 4a5 5 0 0 0 10 0c0-3-2-5-5-9Z',
  fillDone: '#1CAF74',
  fillTodo: '#C5D0DB',
  stroke: '#FFFFFF',
};

export function pathDropletDone(segmentIndex, pathItems = []) {
  const start = pathItems[segmentIndex];
  if (!start) return false;
  return start.state === 'completed';
}
