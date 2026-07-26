import React, { createContext, useContext } from 'react';

export const AdminTabContext = createContext(null);

export function AdminTabProvider({ value, children }) {
  return <AdminTabContext.Provider value={value}>{children}</AdminTabContext.Provider>;
}

export function useAdminTab() {
  const ctx = useContext(AdminTabContext);
  if (!ctx) {
    throw new Error('useAdminTab must be used within AdminTabProvider');
  }
  return ctx;
}