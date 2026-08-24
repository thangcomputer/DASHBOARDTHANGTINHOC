import React, { createContext, useContext } from 'react';
import useSWR from 'swr';
import api from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';

const AdminFinanceContext = createContext(null);

export function AdminFinanceProvider({ children, activeTab }) {
  const { selectedBranchId } = useBranch();
  
  const financeFetcher = async ([, branch_id]) => {
    const params = {
      limit: 100,
      page: 1,
      ...(branch_id ? { branch_id } : {}),
    };
    const [resTx, firstPage] = await Promise.all([
      api.transactions.getAll(branch_id ? { branch_id } : {}),
      api.students.getAll(params),
    ]);

    let financeStudents = firstPage?.success ? (firstPage.data || []) : [];
    const totalPages = Number(firstPage?.totalPages) || 1;
    if (firstPage?.success && totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          api.students.getAll({ ...params, page: i + 2 }),
        ),
      );
      rest.forEach((pageRes) => {
        if (pageRes?.success && Array.isArray(pageRes.data)) {
          financeStudents = financeStudents.concat(pageRes.data);
        }
      });
    }

    return {
      financialData: resTx?.success ? (resTx.data || []) : [],
      financeStudents,
    };
  };

  const { data: financeRes, isValidating: isLoadingFinance } = useSWR(
    activeTab === 'finance' ? ['admin_finance_v2', selectedBranchId] : null,
    financeFetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false, dedupingInterval: 20_000 },
  );

  const financialData = financeRes?.financialData || [];
  const financeStudents = financeRes?.financeStudents || [];

  return (
    <AdminFinanceContext.Provider value={{
      financialData, financeStudents, isLoadingFinance, financeFetcher
    }}>
      {children}
    </AdminFinanceContext.Provider>
  );
}

export function useAdminFinance() {
  return useContext(AdminFinanceContext);
}
