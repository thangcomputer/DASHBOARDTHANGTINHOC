/** Khớp web `PathView.pickActivePathTopic` — chủ đề lộ trình ưu tiên. */
export type PathTopicRow = {
  topic: { id: string; name?: string };
  units?: Array<{ id: string; title?: string; description?: string; state?: string }>;
  next?: { unitId?: string; unitTitle?: string } | null;
  totalUnits?: number;
  completedUnits?: number;
};

export type PathOverview = {
  topics?: PathTopicRow[];
};

export { pickActivePathTopic } from './lastPathTopic';
