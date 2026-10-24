export type LearningDeliveryMode = 'instructor' | 'video';

export type LearningLesson = {
  _id: string;
  title: string;
  duration: string;
  progress: number;
  completed: boolean;
  locked: boolean;
  videoUrl?: string;
  content?: string;
  order?: number;
  isUnlocked?: boolean;
  canAccess?: boolean;
};

export type LearningUnit = {
  _id: string;
  title: string;
  sections: LearningLesson[];
};

export type LearningCourse = {
  _id: string;
  title: string;
  subject: string;
  description: string;
  software: string;
  progress: number;
  units: LearningUnit[];
  enrolled?: boolean;
  deliveryMode?: LearningDeliveryMode;
  totalSessions?: number;
  price?: number;
};

export type LearningProgressMap = Record<string, number>;

export type LearningMutationResult = {
  success: boolean;
  message?: string;
  code?: string;
};
