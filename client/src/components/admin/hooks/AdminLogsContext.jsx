import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';

const AdminLogsContext = createContext(null);

export function useAdminLogs() {
  const ctx = useContext(AdminLogsContext);
  if (!ctx) {
    throw new Error('useAdminLogs must be used within AdminLogsProvider');
  }
  return ctx;
}

export function AdminLogsProvider({ children, activeTab }) {
  const [dbLogs, setDbLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const refreshLogs = useCallback(() => {
    setIsLoadingLogs(true);
    return api.systemLogs.getAll(1, 100)
      .then((res) => {
        setDbLogs(Array.isArray(res?.data) ? res.data : []);
        return res;
      })
      .finally(() => setIsLoadingLogs(false));
  }, []);

  useEffect(() => {
    if (activeTab !== 'logs') return undefined;
    let cancelled = false;
    setIsLoadingLogs(true);
    api.systemLogs.getAll(1, 100)
      .then((res) => {
        if (!cancelled) setDbLogs(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setDbLogs([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLogs(false);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

  const value = {
    dbLogs,
    setDbLogs,
    isLoadingLogs,
    setIsLoadingLogs,
    refreshLogs,
  };

  return (
    <AdminLogsContext.Provider value={value}>
      {children}
    </AdminLogsContext.Provider>
  );
}
