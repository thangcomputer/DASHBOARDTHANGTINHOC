/** Giọt nước DewSkill bóng bẩy nối mốc lộ trình (web + mobile). */
export const PATH_DROPLET = {
  path: 'M0-5 C-3-1 -5 1 -5 4a5 5 0 0 0 10 0c0-3-2-5-5-9Z',
  glossyPath: 'M14 2.5 C14 2.5 5 14 5 20.8 A9 9 0 0 0 23 20.8 C23 14 14 2.5 14 2.5 Z',
  fillDone: '#10B981',
  fillDoneTop: '#6EE7B7',
  fillDoneMid: '#10B981',
  fillDoneBot: '#047857',
  fillTodo: '#60A5FA',
  fillTodoTop: '#E0F2FE',
  fillTodoMid: '#7DD3FC',
  fillTodoBot: '#38BDF8',
  stroke: '#FFFFFF',
};

export function pathDropletDone(segmentIndex, pathItems = []) {
  const start = pathItems[segmentIndex];
  if (!start) return false;
  return start.state === 'completed';
}
