import { useState, useCallback, useEffect } from 'react';
import { loadState } from './dataStorage';

/**
 * Materials (documents/videos) state for DataProvider.
 */
export function useDataMaterials({ students, addNotification }) {
  const [materials, setMaterials] = useState(() => loadState('thvp_materials', []));

  useEffect(() => {
    localStorage.setItem('thvp_materials', JSON.stringify(materials));
  }, [materials]);

  const addMaterial = useCallback((material) => {
    const newMat = { ...material, id: Date.now(), uploadDate: new Date().toISOString().split('T')[0] };
    setMaterials(prev => [...prev, newMat]);
    students.filter(Boolean).filter(s => s.course && s.course.includes(material.course || '')).forEach(s => {
      addNotification(s.id, 'student', `Tài liệu mới: ${material.name}`);
    });
    return newMat;
  }, [students, addNotification]);

  const removeMaterial = useCallback((materialId) => {
    setMaterials(prev => prev.filter(m => m.id !== materialId));
  }, []);

  const getMaterialsByCourse = useCallback((courseName) => {
    return materials.filter(m => m.course === courseName || courseName.includes(m.course));
  }, [materials]);

  const getMaterialsByCategory = useCallback((category, courseName) => {
    return materials.filter(m => m.category === category && (m.course === courseName || !courseName || courseName.includes(m.course)));
  }, [materials]);

  return {
    materials,
    setMaterials,
    addMaterial,
    removeMaterial,
    getMaterialsByCourse,
    getMaterialsByCategory,
  };
}
