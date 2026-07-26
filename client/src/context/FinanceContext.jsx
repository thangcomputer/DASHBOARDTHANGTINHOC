import { createContext, useContext, useMemo } from 'react';
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
    const res = await api.transactions.getAll();
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

  const value = useMemo(() => ({
    transactions: data,
    refreshTransactions: mutate,
    isTransactionsLoading: isValidating,
  }), [data, mutate, isValidating]);

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinanceContext() {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    return { transactions: [], refreshTransactions: async () => {}, isTransactionsLoading: false };
  }
  return ctx;
}
