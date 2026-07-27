import { createContext, useContext, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import api from '../services/api';
import { mapTransaction } from '../lib/entityMaps';

const FinanceContext = createContext(null);

function financeKey(user) {
  if (!user?.role) return null;
  const id = user.id || user._id;
  if (user.role === 'admin' || user.role === 'staff') return ['transactions', 'admin'];
  if (user.role === 'teacher') return ['transactions', 'teacher', id];
  return null;
}

async function fetchTransactions(key) {
  const [, scope, teacherId] = key;
  if (scope === 'admin') {
    const res = await api.transactions.getAll({ limit: 200 });
    return res?.success ? res.data.map(mapTransaction) : [];
  }
  const res = await api.transactions.getByTeacher(teacherId);
  return res?.success ? res.data.map(mapTransaction) : [];
}

export function FinanceProvider({ user, children }) {
  const { data = [], mutate, isValidating } = useSWR(
    financeKey(user),
    fetchTransactions,
    { revalidateOnFocus: false, dedupingInterval: 45_000 }
  );

  const setTransactionsLocal = useCallback((updater) => {
    mutate((current = []) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return Array.isArray(next) ? next : current;
    }, { revalidate: false });
  }, [mutate]);

  const value = useMemo(() => ({
    transactions: data,
    refreshTransactions: mutate,
    setTransactionsLocal,
    isTransactionsLoading: isValidating,
  }), [data, mutate, setTransactionsLocal, isValidating]);

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinanceContext() {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    return { transactions: [], refreshTransactions: async () => {}, setTransactionsLocal: () => {}, isTransactionsLoading: false };
  }
  return ctx;
}
