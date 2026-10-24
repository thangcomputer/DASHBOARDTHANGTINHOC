import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../app/AuthContext';
import type { LearningCourse } from './learningTypes';
import { learningService } from './learningService';

export function useStudentLearning() {
  const { request } = useAuth();
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextCourses = await learningService.courses(request);
      setCourses(nextCourses);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Không thể tải khóa học.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { courses, loading, error, refresh };
}
